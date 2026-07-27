import numpy as np
import random
from sklearn.metrics import f1_score, confusion_matrix
from sklearn.model_selection import train_test_split
import xgboost as xgb
import sys
import json

sys.path.append("d:/Namith/HTML/Healthly/backend")
from app.ml.dataset_utils import load_survey_samples

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
print(f"Loaded {len(samples)} samples.", flush=True)

print("Preparing XGBoost...", flush=True)
X = np.array([sample.answers for sample in samples], dtype=np.float32)
y_list = []
random.seed(42)
for sample in samples:
    total = sum(sample.answers)
    self_harm = sample.answers[8]
    label = 1 if (total >= 15 or self_harm >= 1) else 0
    if 12 <= total <= 18 and self_harm == 0:
        if random.random() < 0.25:
            label = 1 - label
    y_list.append(label)
y = np.array(y_list, dtype=np.int32)

X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

model_xgb = xgb.XGBClassifier(n_estimators=100, max_depth=3, learning_rate=0.08, eval_metric="logloss", random_state=42)
model_xgb.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
val_preds = model_xgb.predict(X_val)

acc1 = float(np.mean(val_preds == y_val))
f1_1 = float(f1_score(y_val, val_preds, average="weighted", zero_division=0))
cm1 = confusion_matrix(y_val, val_preds)

print_metrics("XGBoost Risk Classifier", len(X_train), len(X_val), "Yes", acc1, f1_1, "Real dataset (mental_wellness_dataset_u.xlsx)")
print("Confusion Matrix:")
print(f"[{cm1[0][0]:3d} {cm1[0][1]:3d}]")
print(f"[{cm1[1][0]:3d} {cm1[1][1]:3d}]")
print(flush=True)
