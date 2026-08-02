"""Train XGBoost Risk Classifier and LSTM Mental State Classifier on the new mental_wellness_dataset_15000.xlsx (15,000 samples)."""
import json
import random
import sys
import time
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report

# Ensure backend directory is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from app.ml.mental_state_model import MentalStateLSTM, save_mental_state_model
from app.ml.real_dataset_loaders import RESPONSE_SCORE_MAP

ARTIFACTS = BACKEND_DIR / "app" / "ml" / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
DATASET_PATH = BACKEND_DIR.parent / "datasets" / "mental_wellness_dataset_15000.xlsx"

SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)

print("=" * 70)
print("  TRAINING HEALTHLY MODELS ON MENTAL_WELLNESS_DATASET_15000.XLSX  ")
print("=" * 70)
print(f"Loading dataset from: {DATASET_PATH}")

df = pd.read_excel(DATASET_PATH)
print(f"Dataset Loaded Successfully! Total Samples: {len(df)}")

# 1. Parse PHQ-9 items
phq_cols = ['Interest', 'Depressed', 'Sleep', 'Energy', 'Appetite', 'Self Worth', 'Concentration', 'Movement', 'Self Harm Thoughts']
phq_scores = []
labels = []
risk_labels = []

id2label = {0: "stable", 1: "mild_distress", 2: "moderate_distress", 3: "severe_distress", 4: "crisis"}

for _, row in df.iterrows():
    answers = []
    for col in phq_cols:
        val = str(row.get(col, "")).strip().lower()
        score = RESPONSE_SCORE_MAP.get(val, 0)
        answers.append(score)
    
    total = sum(answers)
    self_harm = answers[8]

    # Mental State Label
    if self_harm >= 2:
        label = 4  # crisis
    elif total >= 20:
        label = 3  # severe_distress
    elif total >= 15:
        label = 2  # moderate_distress
    elif total >= 8:
        label = 1  # mild_distress
    else:
        label = 0  # stable

    # Risk Label (1 = at risk / high, 0 = healthy)
    risk_label = 1 if (total >= 15 or self_harm >= 1) else 0

    phq_scores.append(answers)
    labels.append(label)
    risk_labels.append(risk_label)

X_phq = np.array(phq_scores, dtype=np.int64)
y_mental = np.array(labels, dtype=np.int64)
y_risk = np.array(risk_labels, dtype=np.int32)

print(f"\n[Data Overview]")
print(f"  Mental State Distribution: {dict(pd.Series(labels).map(id2label).value_counts())}")
print(f"  Risk Status Distribution:  Healthy: {(y_risk == 0).sum()}, At-Risk: {(y_risk == 1).sum()}")


# ===========================================================
# 1. Train XGBoost Risk Classifier on 15,000 Dataset
# ===========================================================
print("\n" + "=" * 60)
print("[1/2] Training XGBoost Risk Classifier (15,000 samples)")
print("=" * 60)

X_train_xgb, X_val_xgb, y_train_xgb, y_val_xgb = train_test_split(
    X_phq, y_risk, test_size=0.2, random_state=SEED, stratify=y_risk
)

xgb_model = xgb.XGBClassifier(
    n_estimators=250,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="logloss",
    random_state=SEED,
    n_jobs=-1,
)
xgb_model.fit(X_train_xgb, y_train_xgb, eval_set=[(X_val_xgb, y_val_xgb)], verbose=False)

xgb_preds = xgb_model.predict(X_val_xgb)
xgb_acc = float(accuracy_score(y_val_xgb, xgb_preds))
xgb_f1 = float(f1_score(y_val_xgb, xgb_preds, average="weighted"))

print(f"  Validation Accuracy: {xgb_acc:.4f} ({xgb_acc * 100:.2f}%)")
print(f"  Validation F1 Score: {xgb_f1:.4f}")
print(classification_report(y_val_xgb, xgb_preds, target_names=["Healthy", "At-Risk"]))

xgb_model.save_model(str(ARTIFACTS / "xgboost_risk_model.json"))
xgb_meta = {
    "task": "risk_classification",
    "model": "xgboost_classifier",
    "dataset": "mental_wellness_dataset_15000.xlsx",
    "samples": len(df),
    "features": 9,
    "validation_accuracy": round(xgb_acc, 4),
    "validation_f1": round(xgb_f1, 4),
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
}
(ARTIFACTS / "xgboost_risk_metadata.json").write_text(json.dumps(xgb_meta, indent=2))
print(f"  [OK] Artifact saved: {ARTIFACTS / 'xgboost_risk_model.json'}")


# ===========================================================
# 2. Train LSTM Mental State Classifier on 15,000 Dataset
# ===========================================================
print("\n" + "=" * 60)
print("[2/2] Training LSTM Mental State Classifier (15,000 samples)")
print("=" * 60)

X_train_lstm, X_val_lstm, y_train_lstm, y_val_lstm = train_test_split(
    X_phq, y_mental, test_size=0.2, random_state=SEED, stratify=y_mental
)

train_ds = TensorDataset(torch.tensor(X_train_lstm), torch.tensor(y_train_lstm))
val_ds = TensorDataset(torch.tensor(X_val_lstm), torch.tensor(y_val_lstm))

train_loader = DataLoader(train_ds, batch_size=64, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=64)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
lstm_model = MentalStateLSTM(num_labels=len(id2label)).to(device)
optimizer = torch.optim.Adam(lstm_model.parameters(), lr=0.002, weight_decay=1e-4)
criterion = nn.CrossEntropyLoss()

epochs = 15
best_acc = 0.0

for epoch in range(epochs):
    lstm_model.train()
    total_loss = 0.0
    for bx, by in train_loader:
        bx, by = bx.to(device), by.to(device)
        optimizer.zero_grad()
        logits = lstm_model(bx)
        loss = criterion(logits, by)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    lstm_model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for bx, by in val_loader:
            bx, by = bx.to(device), by.to(device)
            preds = lstm_model(bx).argmax(dim=-1)
            correct += (preds == by).sum().item()
            total += by.numel()

    val_acc = correct / total
    if val_acc > best_acc:
        best_acc = val_acc
        save_mental_state_model(
            model=lstm_model,
            path=ARTIFACTS / "lstm_mental_state.pt",
            metadata={
                "task": "mental_state_classification",
                "model": "lstm",
                "dataset": "mental_wellness_dataset_15000.xlsx",
                "samples": len(df),
                "val_accuracy": round(best_acc, 4),
                "label2id": {v: k for k, v in id2label.items()}
            }
        )
    
    print(f"  Epoch {epoch+1:02d}/{epochs:02d} - Loss: {total_loss/len(train_loader):.4f} - Val Acc: {val_acc:.4f} ({val_acc * 100:.2f}%)")

print(f"\n  [OK] Best LSTM Validation Accuracy: {best_acc:.4f} ({best_acc * 100:.2f}%)")
print(f"  [OK] Artifact saved: {ARTIFACTS / 'lstm_mental_state.pt'}")


# Summary Output
summary_file = ARTIFACTS / "training_summary_15000.json"
summary_data = {
    "dataset": "mental_wellness_dataset_15000.xlsx",
    "total_samples": len(df),
    "xgboost_risk": {
        "accuracy": round(xgb_acc, 4),
        "f1": round(xgb_f1, 4)
    },
    "lstm_mental_state": {
        "best_accuracy": round(best_acc, 4)
    },
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
}
summary_file.write_text(json.dumps(summary_data, indent=2))

print("\n" + "=" * 70)
print(f"  TRAINING COMPLETE ON 15,000 DATASET! SUMMARY SAVED TO {summary_file.name}")
print("=" * 70)
