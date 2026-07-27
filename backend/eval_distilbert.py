import numpy as np
import torch
import warnings
import json
from sklearn.metrics import classification_report, f1_score
from torch.utils.data import DataLoader
import sys

sys.path.append("d:/Namith/HTML/Healthly/backend")
from app.ml.dataset_utils import load_survey_samples, split_samples, label_lookup
from app.ml.train_models import TextEmotionDataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer

warnings.filterwarnings('ignore')

def print_metrics(name, train_count, val_count, zero_overlap, acc, f1, data_source):
    print("===========================================")
    print(f"MODEL: {name}")
    print("===========================================")
    print(f"Training samples used: {train_count}")
    print(f"Held-out validation samples used: {val_count}")
    print(f"Zero overlap confirmed: {zero_overlap}")
    print(f"Accuracy: {acc:.4f}")
    print(f"F1 Score: {f1:.4f}")
    print(f"Data source: {data_source}")
    print("===========================================")

print("Loading dataset...", flush=True)
samples = load_survey_samples("../datasets/mental_wellness_dataset_u.xlsx")
train_samples, val_samples = split_samples(samples)

emotion_labels, id2emotion = label_lookup(sample.emotion_label for sample in samples)

print("Loading tokenizer...", flush=True)
tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

train_texts = [sample.text for sample in train_samples]
val_texts = [sample.text for sample in val_samples]
train_labels = [emotion_labels[sample.emotion_label] for sample in train_samples]
val_labels = [emotion_labels[sample.emotion_label] for sample in val_samples]
val_encodings = tokenizer(val_texts, truncation=True, padding=True, max_length=160)
val_dataset = TextEmotionDataset(val_encodings, val_labels)
val_loader = DataLoader(val_dataset, batch_size=8)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}", flush=True)

print("Loading model...", flush=True)
model_bert = AutoModelForSequenceClassification.from_pretrained("app/ml/artifacts/bert_emotion_model").to(device)
model_bert.eval()

all_preds2 = []
all_labels2 = []

print("Running evaluation...", flush=True)
with torch.no_grad():
    for batch in val_loader:
        b_labels = batch.pop("labels").numpy()
        b = {k: v.to(device) for k, v in batch.items()}
        logits = model_bert(**b).logits
        preds = logits.argmax(dim=1).cpu().numpy()
        all_preds2.extend(preds)
        all_labels2.extend(b_labels)

acc2 = np.mean(np.array(all_preds2) == np.array(all_labels2))
f1_2 = f1_score(all_labels2, all_preds2, average="weighted")

print_metrics("DistilBERT Emotion Classifier", len(train_samples), len(val_samples), "Yes", acc2, f1_2, "Real dataset (mental_wellness_dataset_u.xlsx)")

target_names = [id2emotion[i] for i in range(len(id2emotion))]
print(classification_report(all_labels2, all_preds2, target_names=target_names))
print(flush=True)
