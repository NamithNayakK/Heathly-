"""Loaders for all real-world datasets in the Healthly project.

Each loader returns clean numpy arrays / lists ready for model training.
Datasets:
  - data.csv              → XGBoost risk + LSTM mental state
  - Stress.csv            → DistilBERT emotion/stress text classifier
  - data_stress.csv       → SensorBiLSTM physiological stress
  - mental_health_wearable_data.csv → Wav2Vec2 EEG/GSR signal classifier
  - archive/train & test  → DeepFaceCNN (handled via torchvision ImageFolder)
  - Mental Wellness Survey CSV → LSTM mental state (PHQ-9 answers)
  - MMASH/DataPaper       → Supplementary sensor data for SensorBiLSTM
"""
from __future__ import annotations

import ast
import csv
import os
from pathlib import Path
from typing import NamedTuple

import numpy as np


DATASETS_DIR = Path(__file__).resolve().parents[3] / "datasets"


# ──────────────────────────────────────────────────────────────
#  1. data.csv → XGBoost Risk + LSTM Mental State
# ──────────────────────────────────────────────────────────────

RISK_FEATURE_COLUMNS = [
    "PHQ9", "GAD7", "SleepHours", "ExerciseFreq", "SocialActivity",
    "OnlineStress", "GPA", "FamilySupport", "ScreenTime", "AcademicStress",
    "DietQuality", "SelfEfficacy", "PeerRelationship", "FinancialStress",
    "SleepQuality",
]


def load_risk_data() -> tuple[np.ndarray, np.ndarray]:
    """Load data.csv → (X[1800, 15], y[1800]) for XGBoost risk model.
    
    Target: MentalHealthStatus (0 = healthy, 1 = at-risk)
    """
    path = DATASETS_DIR / "data.csv"
    if not path.exists():
        raise FileNotFoundError(f"data.csv not found at {path}")

    rows_x, rows_y = [], []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            features = [float(row[col]) for col in RISK_FEATURE_COLUMNS]
            label = int(row["MentalHealthStatus"])
            rows_x.append(features)
            rows_y.append(label)

    return np.array(rows_x, dtype=np.float32), np.array(rows_y, dtype=np.int32)


def derive_mental_state_from_risk_data() -> tuple[np.ndarray, np.ndarray, dict[int, str]]:
    """Derive mental state labels from data.csv clinical scores.
    
    Uses PHQ-9 and GAD-7 thresholds to create multi-class mental state labels:
      0 = stable (PHQ9 < 5, GAD7 < 5)
      1 = mild_distress (PHQ9 5-9 or GAD7 5-9)
      2 = moderate_distress (PHQ9 10-14 or GAD7 10-14)
      3 = severe_distress (PHQ9 15-19 or GAD7 >= 15)
      4 = crisis (PHQ9 >= 20)
    
    Returns features as integer-binned answers (0-3 scale) for LSTM embedding.
    """
    path = DATASETS_DIR / "data.csv"
    X_raw, _ = load_risk_data()
    
    id2label = {0: "stable", 1: "mild_distress", 2: "moderate_distress", 3: "severe_distress", 4: "crisis"}
    
    answers_list, labels = [], []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            phq9 = float(row["PHQ9"])
            gad7 = float(row["GAD7"])
            
            # Determine mental state from clinical severity
            max_score = max(phq9, gad7)
            if phq9 >= 20:
                label = 4  # crisis
            elif max_score >= 15:
                label = 3  # severe_distress
            elif max_score >= 10:
                label = 2  # moderate_distress
            elif max_score >= 5:
                label = 1  # mild_distress
            else:
                label = 0  # stable
            
            # Convert features to 0-3 integer bins for LSTM embedding
            # PHQ9(0-27)→0-3, GAD7(0-21)→0-3, Sleep(0-12)→0-3, etc.
            binned = [
                min(3, int(phq9 / 7)),                             # PHQ9
                min(3, int(gad7 / 6)),                             # GAD7
                min(3, max(0, 3 - int(float(row["SleepHours"]) / 2.5))),  # Sleep (inverted: less sleep = worse)
                min(3, max(0, 3 - int(float(row["ExerciseFreq"])))),       # Exercise (inverted)
                min(3, max(0, 3 - int(float(row["SocialActivity"]) / 2.5))),  # Social (inverted)
                min(3, int(float(row["OnlineStress"]) / 2.5)),    # OnlineStress
                min(3, int(float(row["AcademicStress"]) / 2.5)),  # AcademicStress
                min(3, int(float(row["FinancialStress"]) / 2.5)), # FinancialStress
                min(3, int(float(row["ScreenTime"]) / 3)),        # ScreenTime
            ]
            answers_list.append(binned)
            labels.append(label)
    
    return np.array(answers_list, dtype=np.int64), np.array(labels, dtype=np.int64), id2label


# ──────────────────────────────────────────────────────────────
#  2. Stress.csv → DistilBERT Emotion/Stress Classifier
# ──────────────────────────────────────────────────────────────

# Map subreddits to emotion categories for multi-class classification
SUBREDDIT_EMOTION_MAP = {
    "ptsd": "anxiety",
    "anxiety": "anxiety",
    "stress": "overwhelm",
    "domesticviolence": "fear",
    "survivorsofabuse": "fear",
    "relationships": "sadness",
    "assistance": "distress",
    "homeless": "distress",
    "almosthomeless": "distress",
    "food_pantry": "distress",
}

EMOTION_CLASSES = ["stable", "sadness", "anxiety", "fear", "overwhelm", "distress"]


class TextSample(NamedTuple):
    text: str
    emotion_label: str


def load_stress_text_data() -> list[TextSample]:
    """Load Stress.csv → list of (text, emotion_label) for DistilBERT.
    
    label=0 → 'stable', label=1 → mapped from subreddit to emotion category.
    """
    path = DATASETS_DIR / "Stress.csv"
    if not path.exists():
        raise FileNotFoundError(f"Stress.csv not found at {path}")

    samples = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = row["text"].strip()
            if not text or len(text) < 10:
                continue
            
            label_int = int(row["label"])
            if label_int == 0:
                emotion = "stable"
            else:
                subreddit = row["subreddit"].strip().lower()
                emotion = SUBREDDIT_EMOTION_MAP.get(subreddit, "overwhelm")
            
            # Truncate very long texts to ~512 tokens worth
            if len(text) > 2000:
                text = text[:2000]
            
            samples.append(TextSample(text=text, emotion_label=emotion))
    
    return samples


# ──────────────────────────────────────────────────────────────
#  3. data_stress.csv → SensorBiLSTM
# ──────────────────────────────────────────────────────────────

SENSOR_FEATURE_COLUMNS = [
    "snoring range", "respiration rate", "body temperature",
    "limb movement", "blood oxygen ", "eye movement",
    "hours of sleep", "heart rate ",
]


def load_sensor_stress_data() -> tuple[np.ndarray, np.ndarray]:
    """Load data_stress.csv → (X[630, 8], y[630]) for SensorBiLSTM.
    
    Features are normalized to [0, 1] range.
    Target: Binarized stress (0=low for levels 0-1, 1=high for levels 2-4)
    to match the existing SensorBiLSTM binary output.
    """
    path = DATASETS_DIR / "data_stress.csv"
    if not path.exists():
        raise FileNotFoundError(f"data_stress.csv not found at {path}")

    rows_x, rows_y = [], []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        # Normalize header keys to strip extra spaces or BOM
        clean_field_map = {k.strip(): k for k in (reader.fieldnames or [])}
        
        target_cols = [
            "snoring range", "respiration rate", "body temperature",
            "limb movement", "blood oxygen", "eye movement",
            "hours of sleep", "heart rate"
        ]
        
        for row in reader:
            features = []
            for col in target_cols:
                raw_val = row.get(clean_field_map.get(col, col), "0.0")
                if raw_val is None or raw_val.strip().upper() in ("NULL", "", "NONE"):
                    val = 0.0
                else:
                    try:
                        val = float(raw_val)
                    except ValueError:
                        val = 0.0
                features.append(val)
                
            raw_stress = row.get(clean_field_map.get("Stress Levels", "Stress Levels"), "0")
            try:
                stress_level = int(float(raw_stress))
            except ValueError:
                stress_level = 0
                
            rows_x.append(features)
            # Binarize: 0-1 → low stress (0), 2-4 → high stress (1)
            rows_y.append(1 if stress_level >= 2 else 0)

    X = np.array(rows_x, dtype=np.float32)
    y = np.array(rows_y, dtype=np.int64)
    
    # Fill zero placeholders with column means
    for c in range(X.shape[1]):
        non_zeros = X[X[:, c] > 0, c]
        if len(non_zeros) > 0:
            X[X[:, c] == 0, c] = non_zeros.mean()
            
    # Normalize each feature column to [0, 1]
    X_min = X.min(axis=0, keepdims=True)
    X_max = X.max(axis=0, keepdims=True)
    X = (X - X_min) / (X_max - X_min + 1e-8)
    
    return X, y


def load_mmash_sensor_data() -> tuple[np.ndarray, np.ndarray]:
    """Load MMASH dataset → aggregated physiological features per user.
    
    Extracts: mean HR, HRV (from RR intervals), sleep efficiency, 
    sleep duration, activity level, and stress (from STAI questionnaire).
    Returns (X[n_users, 4], y[n_users]) — features normalized for SensorBiLSTM.
    """
    base = DATASETS_DIR / "MMASH" / "DataPaper"
    if not base.exists():
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.int64)

    X_list, y_list = [], []
    user_dirs = sorted([d for d in base.iterdir() if d.is_dir() and d.name.startswith("user_")])
    
    for user_dir in user_dirs:
        try:
            # Read questionnaire for stress label (STAI State Anxiety)
            q_path = user_dir / "questionnaire.csv"
            if not q_path.exists():
                continue
            with open(q_path, "r") as f:
                reader = csv.DictReader(f)
                q_row = next(reader)
            stai1 = float(q_row["STAI1"])  # State anxiety (20-80 scale)
            daily_stress = float(q_row["Daily_stress"])
            
            # Binary stress: STAI1 >= 40 or daily_stress >= 20 → high stress
            stress_label = 1 if (stai1 >= 40 or daily_stress >= 20) else 0
            
            # Read actigraph for mean HR and step count
            acti_path = user_dir / "Actigraph.csv"
            if acti_path.exists():
                hr_vals, step_vals = [], []
                with open(acti_path, "r") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        try:
                            hr = float(row["HR"])
                            if hr > 0:
                                hr_vals.append(hr)
                            step_vals.append(float(row["Steps"]))
                        except (ValueError, KeyError):
                            continue
                mean_hr = np.mean(hr_vals) if hr_vals else 70.0
                total_steps = np.sum(step_vals) if step_vals else 5000.0
            else:
                mean_hr, total_steps = 70.0, 5000.0
            
            # Read RR intervals for HRV estimate
            rr_path = user_dir / "RR.csv"
            if rr_path.exists():
                ibi_vals = []
                with open(rr_path, "r") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        try:
                            ibi_vals.append(float(row["ibi_s"]))
                        except (ValueError, KeyError):
                            continue
                # RMSSD-based HRV
                if len(ibi_vals) > 1:
                    diffs = np.diff(ibi_vals)
                    hrv = float(np.sqrt(np.mean(diffs**2))) * 1000  # ms
                else:
                    hrv = 50.0
            else:
                hrv = 50.0
            
            # Read sleep data
            sleep_path = user_dir / "sleep.csv"
            if sleep_path.exists():
                sleep_hours_total = 0.0
                with open(sleep_path, "r") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        try:
                            tst = float(row["Total Sleep Time (TST)"])
                            sleep_hours_total += tst / 60.0  # minutes → hours
                        except (ValueError, KeyError):
                            continue
            else:
                sleep_hours_total = 7.0
            
            # Normalize to match SensorBiLSTM expected input: [HR/120, HRV/100, sleep/10, steps/10000]
            X_list.append([
                min(1.0, mean_hr / 120.0),
                min(1.0, hrv / 100.0),
                min(1.0, sleep_hours_total / 10.0),
                min(1.0, total_steps / 10000.0),
            ])
            y_list.append(stress_label)
            
        except Exception as e:
            print(f"  Warning: Could not process {user_dir.name}: {e}")
            continue
    
    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.int64)


# ──────────────────────────────────────────────────────────────
#  4. mental_health_wearable_data.csv → Wav2Vec2 Speech CNN
# ──────────────────────────────────────────────────────────────

WEARABLE_EMOTION_MAP = {
    "Calm": 0,
    "Anxious": 1,
    "Stressed": 2,
}


def load_wearable_eeg_data() -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Load mental_health_wearable_data.csv → (X[500, 5, 32], y[500]) for Wav2Vec2 CNN.
    
    Repurposes EEG frequency bands + GSR as multi-channel time-series signal.
    The 4 EEG bands + 1 GSR channel → 5 input channels, replicated across
    32 synthetic time-steps to match the CNN's expected [features, time] shape.
    
    Target: Emotional_State mapped to 3 classes.
    """
    path = DATASETS_DIR / "mental_health_wearable_data.csv"
    if not path.exists():
        raise FileNotFoundError(f"mental_health_wearable_data.csv not found at {path}")

    emotion_labels = ["calm", "anxious", "stressed"]
    X_list, y_list = [], []
    
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            emotion = row["Emotional_State"].strip()
            if emotion not in WEARABLE_EMOTION_MAP:
                continue
            
            # Parse EEG frequency bands (stored as string list)
            try:
                eeg_bands = ast.literal_eval(row["EEG_Frequency_Bands"])
                gsr = float(row["GSR_Values"])
            except (ValueError, SyntaxError):
                continue
            
            if len(eeg_bands) != 4:
                continue
            
            # Create 5-channel signal: [4 EEG bands + GSR]
            channels = list(eeg_bands) + [gsr]
            
            # Create a [5, 32] pseudo-spectrogram by adding temporal variation
            rng = np.random.RandomState(hash(row.get("Timestamp", "")) % (2**31))
            signal = np.zeros((5, 32), dtype=np.float32)
            for ch_idx, base_val in enumerate(channels):
                # Base value with temporal noise to simulate real signal variation
                noise = rng.randn(32) * 0.15 * abs(base_val + 0.01)
                temporal = np.sin(np.linspace(0, 2 * np.pi * (ch_idx + 1), 32)) * 0.1 * abs(base_val + 0.01)
                signal[ch_idx, :] = base_val + noise + temporal
            
            X_list.append(signal)
            y_list.append(WEARABLE_EMOTION_MAP[emotion])
    
    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int64)
    
    # Normalize per-channel
    for ch in range(X.shape[1]):
        ch_min = X[:, ch, :].min()
        ch_max = X[:, ch, :].max()
        if ch_max - ch_min > 1e-8:
            X[:, ch, :] = (X[:, ch, :] - ch_min) / (ch_max - ch_min)
    
    return X, y, emotion_labels


# ──────────────────────────────────────────────────────────────
#  5. Survey CSV → Additional LSTM samples
# ──────────────────────────────────────────────────────────────

RESPONSE_SCORE_MAP = {
    "not at all": 0,
    "several days": 1,
    "more than half the days": 2,
    "nearly every day": 3,
}

SURVEY_PHQ9_COLUMNS = [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself or that you are a failure",
    "Trouble concentrating on things",
    "Moving or speaking slowly, or being unusually restless",
    "Thoughts that you would be better off dead or hurting yourself",
]


def load_survey_csv_samples() -> tuple[np.ndarray, np.ndarray, dict[int, str]]:
    """Load mental_wellness_dataset_15000.xlsx (or survey CSV) → (answers[N, 9], labels[N]) for LSTM.
    
    Returns PHQ-9 answer scores and derived mental state labels across all 15,000 samples.
    """
    xlsx_path = DATASETS_DIR / "mental_wellness_dataset_15000.xlsx"
    csv_path = DATASETS_DIR / "Mental Wellness Survey for Research Study  (Responses) - Form Responses 1.csv"
    
    id2label = {0: "stable", 1: "mild_distress", 2: "moderate_distress", 3: "severe_distress", 4: "crisis"}
    answers_list, labels = [], []

    if xlsx_path.exists():
        import pandas as pd
        df = pd.read_excel(xlsx_path)
        phq_cols = ['Interest', 'Depressed', 'Sleep', 'Energy', 'Appetite', 'Self Worth', 'Concentration', 'Movement', 'Self Harm Thoughts']
        for _, row in df.iterrows():
            try:
                phq9_answers = []
                for col in phq_cols:
                    val = str(row.get(col, "")).strip().lower()
                    score = RESPONSE_SCORE_MAP.get(val, 0)
                    phq9_answers.append(score)
                
                total = sum(phq9_answers)
                self_harm = phq9_answers[8]
                
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
                
                answers_list.append(phq9_answers)
                labels.append(label)
            except Exception:
                continue
        print(f"  [Loader] Loaded {len(answers_list)} samples from mental_wellness_dataset_15000.xlsx")
        return np.array(answers_list, dtype=np.int64), np.array(labels, dtype=np.int64), id2label

    if not csv_path.exists():
        return np.empty((0, 9), dtype=np.int64), np.empty((0,), dtype=np.int64), {}

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                phq9_answers = []
                for col in SURVEY_PHQ9_COLUMNS:
                    val = row.get(col, "").strip().lower()
                    score = RESPONSE_SCORE_MAP.get(val, 0)
                    phq9_answers.append(score)
                
                total = sum(phq9_answers)
                self_harm = phq9_answers[8]
                
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
                
                answers_list.append(phq9_answers)
                labels.append(label)
            except Exception:
                continue
    
    return np.array(answers_list, dtype=np.int64), np.array(labels, dtype=np.int64), id2label
