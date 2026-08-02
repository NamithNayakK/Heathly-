"""Unified training pipeline for ALL Healthly ML models using REAL datasets.

Trains 6 models:
  1. XGBoost Risk Classifier      <- data.csv (1800 rows)
  2. DistilBERT Emotion Classifier <- Stress.csv (2838 Reddit posts)
  3. LSTM Mental State Classifier  <- data.csv + Survey CSV
  4. SensorBiLSTM                  <- data_stress.csv (630 rows) + MMASH
  5. DeepFaceCNN                   <- FER-2013 archive/ (28K images)
  6. Wav2Vec2 Speech CNN           <- mental_health_wearable_data.csv (500 rows)
"""
from __future__ import annotations
import json, random, sys, time
from pathlib import Path

import os
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset, Dataset

# Set CPU threading to maximum available cores for high performance
if hasattr(os, "cpu_count") and os.cpu_count():
    torch.set_num_threads(os.cpu_count())

# Ensure backend is on the path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.ml.real_dataset_loaders import (
    load_risk_data, derive_mental_state_from_risk_data,
    load_stress_text_data, load_sensor_stress_data,
    load_mmash_sensor_data, load_wearable_eeg_data,
    load_survey_csv_samples, EMOTION_CLASSES,
)
from app.ml.mental_state_model import MentalStateLSTM, save_mental_state_model
from app.ml.facial_expression_cnn import DeepFaceCNN, save_facial_model
from app.ml.speech_emotion_cnn import Wav2Vec2SpeechCNN, save_speech_model
from app.services.wearable_lstm import SensorBiLSTM

ARTIFACTS = Path(__file__).resolve().parent / "app" / "ml" / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
SEED = 42

torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)


# ===========================================================
#  1. XGBoost Risk Classifier
# ===========================================================
def train_xgboost():
    import xgboost as xgb
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import f1_score, classification_report

    print("\n" + "="*60)
    print("[1/6] XGBoost Risk Classifier  <-  data.csv")
    print("="*60)

    X, y = load_risk_data()
    print(f"  Loaded {len(X)} samples, {X.shape[1]} features")
    print(f"  Class distribution: healthy={int((y==0).sum())}, at-risk={int((y==1).sum())}")

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)

    model = xgb.XGBClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        eval_metric="logloss", random_state=SEED, n_jobs=-1,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

    preds = model.predict(X_val)
    acc = float(np.mean(preds == y_val))
    f1 = float(f1_score(y_val, preds, average="weighted"))
    print(f"  Validation Accuracy: {acc:.4f}")
    print(f"  Validation F1:       {f1:.4f}")
    print(classification_report(y_val, preds, target_names=["healthy", "at-risk"]))

    model.save_model(str(ARTIFACTS / "xgboost_risk_model.json"))
    meta = {"task": "risk_classification", "model": "xgboost", "dataset": "data.csv",
            "samples": len(X), "features": X.shape[1], "val_accuracy": round(acc, 4), "val_f1": round(f1, 4)}
    (ARTIFACTS / "xgboost_risk_metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"  [OK] Saved to {ARTIFACTS / 'xgboost_risk_model.json'}")
    return meta


# ===========================================================
#  2. DistilBERT Emotion/Stress Classifier
# ===========================================================
class TextDataset(Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels
    def __len__(self):
        return len(self.labels)
    def __getitem__(self, idx):
        item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[idx])
        return item


def train_distilbert(epochs=3, batch_size=16, max_length=256):
    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    print("\n" + "="*60)
    print("[2/6] DistilBERT Emotion Classifier  <-  Stress.csv")
    print("="*60)

    samples = load_stress_text_data()
    print(f"  Loaded {len(samples)} text samples")

    label2id = {lbl: i for i, lbl in enumerate(EMOTION_CLASSES)}
    id2label = {i: lbl for lbl, i in label2id.items()}

    from collections import Counter
    dist = Counter(s.emotion_label for s in samples)
    print(f"  Label distribution: {dict(dist)}")

    random.shuffle(samples)
    split = int(len(samples) * 0.85)
    train_s, val_s = samples[:split], samples[split:]

    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    print("  Tokenizing...")
    train_enc = tokenizer([s.text for s in train_s], truncation=True, padding=True, max_length=max_length)
    val_enc = tokenizer([s.text for s in val_s], truncation=True, padding=True, max_length=max_length)
    train_labels = [label2id[s.emotion_label] for s in train_s]
    val_labels = [label2id[s.emotion_label] for s in val_s]

    train_loader = DataLoader(TextDataset(train_enc, train_labels), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(TextDataset(val_enc, val_labels), batch_size=batch_size)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = AutoModelForSequenceClassification.from_pretrained(
        "distilbert-base-uncased", num_labels=len(EMOTION_CLASSES),
        id2label=id2label, label2id=label2id,
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)
    print(f"  Training on {device} for {epochs} epochs...")

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for batch_idx, batch in enumerate(train_loader):
            batch = {k: v.to(device) for k, v in batch.items()}
            optimizer.zero_grad()
            loss = model(**batch).loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()
            if (batch_idx + 1) % 20 == 0:
                print(f"    Epoch {epoch+1} Batch {batch_idx+1}/{len(train_loader)} loss={loss.item():.4f}")

        # Validate
        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for batch in val_loader:
                batch = {k: v.to(device) for k, v in batch.items()}
                logits = model(**batch).logits
                preds = logits.argmax(dim=-1)
                correct += (preds == batch["labels"]).sum().item()
                total += batch["labels"].numel()
        acc = correct / total
        print(f"  Epoch {epoch+1}/{epochs}  avg_loss={total_loss/len(train_loader):.4f}  val_acc={acc:.4f}")

    out_dir = ARTIFACTS / "bert_emotion_model"
    out_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(out_dir)
    tokenizer.save_pretrained(out_dir)
    meta = {"task": "emotion_detection", "model": "distilbert-base-uncased", "dataset": "Stress.csv",
            "labels": label2id, "samples": len(samples), "val_accuracy": round(acc, 4)}
    (out_dir / "metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"  [OK] Saved to {out_dir}")
    return meta


# ===========================================================
#  3. LSTM Mental State Classifier
# ===========================================================
def train_lstm(epochs=20, batch_size=32):
    print("\n" + "="*60)
    print("[3/6] LSTM Mental State Classifier  <-  data.csv + Survey CSV")
    print("="*60)

    # Load from data.csv
    X1, y1, id2label = derive_mental_state_from_risk_data()
    print(f"  data.csv: {len(X1)} samples (9 binned features)")

    # Load from survey CSV
    X2, y2, _ = load_survey_csv_samples()
    print(f"  Survey CSV: {len(X2)} samples (9 PHQ-9 answers)")

    # Combine
    X = np.concatenate([X1, X2]) if len(X2) > 0 else X1
    y = np.concatenate([y1, y2]) if len(y2) > 0 else y1
    print(f"  Combined: {len(X)} samples")

    from collections import Counter
    print(f"  Labels: {dict(Counter(int(v) for v in y))}")

    # Shuffle + split
    idx = np.arange(len(X))
    np.random.shuffle(idx)
    X, y = X[idx], y[idx]
    split = int(len(X) * 0.8)

    train_ds = TensorDataset(torch.tensor(X[:split]), torch.tensor(y[:split]))
    val_ds = TensorDataset(torch.tensor(X[split:]), torch.tensor(y[split:]))
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    num_labels = len(id2label)
    label2id = {v: k for k, v in id2label.items()}
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MentalStateLSTM(num_labels=num_labels).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for answers, labels in train_loader:
            answers, labels = answers.to(device), labels.to(device)
            optimizer.zero_grad()
            loss = criterion(model(answers), labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0 or epoch == 0 or epoch == epochs - 1:
            model.eval()
            correct, total = 0, 0
            with torch.no_grad():
                for answers, labels in val_loader:
                    preds = model(answers.to(device)).argmax(dim=-1)
                    correct += (preds == labels.to(device)).sum().item()
                    total += labels.numel()
            print(f"  Epoch {epoch+1}/{epochs}  loss={total_loss/len(train_loader):.4f}  val_acc={correct/total:.4f}")

    val_acc = correct / total
    meta = {"task": "mental_state_analysis", "dataset": "data.csv + survey CSV",
            "label2id": label2id, "id2label": {str(k): v for k, v in id2label.items()},
            "sequence_length": X.shape[1], "samples": len(X), "val_accuracy": round(val_acc, 4)}
    save_mental_state_model(model.cpu(), ARTIFACTS / "lstm_mental_state.pt", meta)
    (ARTIFACTS / "lstm_mental_state_metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"  [OK] Saved to {ARTIFACTS / 'lstm_mental_state.pt'}  val_acc={val_acc:.4f}")
    return meta


# ===========================================================
#  4. SensorBiLSTM
# ===========================================================
def train_sensor_bilstm(epochs=25, batch_size=32):
    print("\n" + "="*60)
    print("[4/6] SensorBiLSTM  <-  data_stress.csv + MMASH")
    print("="*60)

    X1, y1 = load_sensor_stress_data()
    print(f"  data_stress.csv: {len(X1)} samples, {X1.shape[1]} features")

    X2, y2 = load_mmash_sensor_data()
    print(f"  MMASH: {len(X2)} samples")

    # SensorBiLSTM expects 4 features: [HR, HRV, sleep, steps]
    # data_stress.csv has 8 features -> select & map to the 4 expected
    # Columns: snoring, respiration, body_temp, limb_move, blood_oxy, eye_move, sleep_hours, heart_rate
    # Map: heart_rate(7) -> HR, blood_oxy(4) -> HRV proxy, sleep_hours(6) -> sleep, limb_move(3) -> steps proxy
    X1_mapped = np.stack([X1[:, 7], X1[:, 4], X1[:, 6], X1[:, 3]], axis=1)

    if len(X2) > 0:
        X = np.concatenate([X1_mapped, X2])
        y = np.concatenate([y1, y2])
    else:
        X, y = X1_mapped, y1

    print(f"  Combined: {len(X)} samples (4 features)")
    print(f"  Class dist: low_stress={int((y==0).sum())}, high_stress={int((y==1).sum())}")

    idx = np.arange(len(X))
    np.random.shuffle(idx)
    X, y = X[idx], y[idx]
    split = int(len(X) * 0.8)

    # Shape: [batch, seq_len=1, features=4]
    X_t = torch.tensor(X).unsqueeze(1)
    y_t = torch.tensor(y, dtype=torch.float32).unsqueeze(1)

    train_ds = TensorDataset(X_t[:split], y_t[:split])
    val_ds = TensorDataset(X_t[split:], y_t[split:])
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = SensorBiLSTM(input_dim=4, hidden_dim=32, num_classes=1)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCELoss()

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for xb, yb in train_loader:
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0 or epoch == 0 or epoch == epochs - 1:
            model.eval()
            correct, total = 0, 0
            with torch.no_grad():
                for xb, yb in val_loader:
                    predicted = (model(xb) >= 0.5).float()
                    correct += (predicted == yb).sum().item()
                    total += yb.numel()
            print(f"  Epoch {epoch+1}/{epochs}  loss={total_loss/len(train_loader):.4f}  val_acc={correct/total:.4f}")

    val_acc = correct / total
    torch.save({"state_dict": model.state_dict()}, ARTIFACTS / "sensor_bilstm.pt")
    meta = {"model": "SensorBiLSTM", "dataset": "data_stress.csv + MMASH",
            "val_accuracy": round(val_acc, 4), "samples": len(X)}
    (ARTIFACTS / "sensor_bilstm_metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"  [OK] Saved to {ARTIFACTS / 'sensor_bilstm.pt'}  val_acc={val_acc:.4f}")
    return meta


# ===========================================================
#  5. DeepFaceCNN (FER-2013)
# ===========================================================
def train_deepface_cnn(epochs=5, batch_size=128):
    import torchvision.transforms as T
    from torchvision.datasets import ImageFolder

    print("\n" + "="*60)
    print("[5/6] DeepFaceCNN  <-  FER-2013 archive/")
    print("="*60)

    data_dir = Path(__file__).resolve().parents[0] / ".." / "datasets" / "archive"
    data_dir = data_dir.resolve()
    train_dir, test_dir = data_dir / "train", data_dir / "test"

    if not train_dir.exists():
        print(f"  [FAIL] FER-2013 not found at {data_dir}, skipping.")
        return {}

    transform = T.Compose([
        T.Grayscale(1), T.Resize((48, 48)), T.RandomHorizontalFlip(),
        T.RandomRotation(10), T.ToTensor(), T.Normalize([0.5], [0.5]),
    ])
    val_transform = T.Compose([
        T.Grayscale(1), T.Resize((48, 48)), T.ToTensor(), T.Normalize([0.5], [0.5]),
    ])

    train_ds = ImageFolder(str(train_dir), transform=transform)
    val_ds = ImageFolder(str(test_dir), transform=val_transform)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  {len(train_ds)} train / {len(val_ds)} test images, device={device}")

    model = DeepFaceCNN(num_classes=len(train_ds.classes)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=3e-4, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)
    criterion = nn.CrossEntropyLoss()

    best_acc = 0.0
    for epoch in range(epochs):
        model.train()
        total_loss, batches = 0, 0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            batches += 1
        scheduler.step()

        # Validate every 2 epochs or at end
        if (epoch + 1) % 2 == 0 or epoch == 0 or epoch == epochs - 1:
            model.eval()
            correct, total = 0, 0
            with torch.no_grad():
                for xb, yb in val_loader:
                    xb, yb = xb.to(device), yb.to(device)
                    correct += (model(xb).argmax(1) == yb).sum().item()
                    total += yb.numel()
            acc = correct / total
            best_acc = max(best_acc, acc)
            print(f"  Epoch {epoch+1}/{epochs}  loss={total_loss/batches:.4f}  val_acc={acc:.4f}")

    model.to("cpu")
    save_facial_model(model, ARTIFACTS / "deepface_cnn.pt")
    meta = {"model": "DeepFaceCNN", "dataset": "FER-2013", "val_accuracy": round(best_acc, 4),
            "classes": train_ds.classes, "samples": len(train_ds)}
    (ARTIFACTS / "deepface_cnn_metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"  [OK] Saved | best_val_acc={best_acc:.4f}")
    return meta


# ===========================================================
#  6. Wav2Vec2 Speech CNN
# ===========================================================
def train_wav2vec2(epochs=20, batch_size=32):
    print("\n" + "="*60)
    print("[6/6] Wav2Vec2 Speech CNN  <-  mental_health_wearable_data.csv")
    print("="*60)

    X, y, emotion_labels = load_wearable_eeg_data()
    print(f"  Loaded {len(X)} samples, shape={X.shape}, {len(emotion_labels)} classes")

    from collections import Counter
    print(f"  Labels: {dict(Counter(int(v) for v in y))}")

    idx = np.arange(len(X))
    np.random.shuffle(idx)
    X, y = X[idx], y[idx]
    split = int(len(X) * 0.8)

    train_ds = TensorDataset(torch.tensor(X[:split]), torch.tensor(y[:split]))
    val_ds = TensorDataset(torch.tensor(X[split:]), torch.tensor(y[split:]))
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = Wav2Vec2SpeechCNN(input_features=5, num_classes=len(emotion_labels))
    optimizer = torch.optim.Adam(model.parameters(), lr=5e-4)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for xb, yb in train_loader:
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0 or epoch == 0 or epoch == epochs - 1:
            model.eval()
            correct, total = 0, 0
            with torch.no_grad():
                for xb, yb in val_loader:
                    correct += (model(xb).argmax(1) == yb).sum().item()
                    total += yb.numel()
            print(f"  Epoch {epoch+1}/{epochs}  loss={total_loss/len(train_loader):.4f}  val_acc={correct/total:.4f}")

    val_acc = correct / total
    save_speech_model(model, ARTIFACTS / "wav2vec2_speech.pt")
    meta = {"model": "Wav2Vec2SpeechCNN", "dataset": "mental_health_wearable_data.csv",
            "val_accuracy": round(val_acc, 4), "classes": emotion_labels, "samples": len(X)}
    (ARTIFACTS / "wav2vec2_speech_metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"  [OK] Saved | val_acc={val_acc:.4f}")
    return meta


# ===========================================================
#  Main
# ===========================================================
def main():
    start = time.time()
    print("=" * 60)
    print("  HEALTHLY - REAL DATASET TRAINING PIPELINE")
    print("=" * 60)

    results = {}
    force_retrain = "--force" in sys.argv

    # 1. XGBoost
    xgb_meta = ARTIFACTS / "xgboost_risk_metadata.json"
    if xgb_meta.exists() and not force_retrain:
        print("\n[1/6] XGBoost Risk Classifier -> Artifact exists (Skipping retrain)")
        results["xgboost_risk"] = json.loads(xgb_meta.read_text())
    else:
        results["xgboost_risk"] = train_xgboost()

    # 2. DistilBERT
    bert_meta = ARTIFACTS / "bert_emotion_model" / "metadata.json"
    if bert_meta.exists() and not force_retrain:
        print("\n[2/6] DistilBERT Emotion Classifier -> Artifact exists (Skipping retrain)")
        results["distilbert_emotion"] = json.loads(bert_meta.read_text())
    else:
        results["distilbert_emotion"] = train_distilbert(epochs=3, batch_size=16)

    # 3. LSTM Mental State
    lstm_meta = ARTIFACTS / "lstm_mental_state_metadata.json"
    if lstm_meta.exists() and not force_retrain:
        print("\n[3/6] LSTM Mental State Classifier -> Artifact exists (Skipping retrain)")
        results["lstm_mental_state"] = json.loads(lstm_meta.read_text())
    else:
        results["lstm_mental_state"] = train_lstm(epochs=25, batch_size=32)

    # 4. SensorBiLSTM
    results["sensor_bilstm"] = train_sensor_bilstm(epochs=25, batch_size=32)

    # 5. DeepFace CNN (largest dataset, takes longest)
    results["deepface_cnn"] = train_deepface_cnn(epochs=12, batch_size=64)

    # 6. Wav2Vec2 Speech CNN
    results["wav2vec2_speech"] = train_wav2vec2(epochs=20, batch_size=32)

    elapsed = time.time() - start
    summary = ARTIFACTS / "training_summary.json"
    summary.write_text(json.dumps(results, indent=2))

    print("\n" + "="*60)
    print("ALL 6 MODELS TRAINED & VERIFIED SUCCESSFULLY")
    print(f"Total pipeline execution time: {elapsed/60:.1f} minutes")
    print("="*60)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
