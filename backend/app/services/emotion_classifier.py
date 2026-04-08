from functools import lru_cache

from transformers import pipeline

MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"


@lru_cache
def get_emotion_pipeline():
    return pipeline("text-classification", model=MODEL_NAME, return_all_scores=False)


def analyze_emotion(text: str) -> tuple[str, float]:
    try:
        classifier = get_emotion_pipeline()
        result = classifier(text)[0]
        label = str(result.get("label", "neutral")).lower()
        score = float(result.get("score", 0.0))
        return label, round(score, 4)
    except Exception:
        return "neutral", 0.0
