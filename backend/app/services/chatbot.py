from app.services.emotion_classifier import analyze_emotion

DISTRESS_KEYWORDS = {
    "suicide",
    "self-harm",
    "kill myself",
    "hopeless",
    "end my life",
    "worthless",
}

SEVERE_KEYWORDS = {
    "suicidal",
    "can't go on",
    "no reason to live",
    "want to die",
}


def generate_cbt_response(message: str) -> dict:
    lowered = message.lower()
    emotion, confidence = analyze_emotion(message)

    keyword_hit = any(keyword in lowered for keyword in DISTRESS_KEYWORDS)
    severe_hit = any(keyword in lowered for keyword in SEVERE_KEYWORDS)
    emotion_risk = 0.25 if emotion in {"sadness", "fear", "anger"} and confidence >= 0.70 else 0.05
    keyword_risk = 0.60 if keyword_hit else 0.0
    severe_risk = 0.30 if severe_hit else 0.0
    base_risk = 0.05
    risk_probability = min(0.99, round(base_risk + emotion_risk + keyword_risk + severe_risk, 4))
    escalation_required = risk_probability >= 0.65

    if escalation_required:
        response = (
            "I hear that you're in a very painful place right now. You're not alone. "
            "Please contact a trusted person or local emergency/crisis service immediately, "
            "and consider urgent consultation with a mental health professional."
        )
    elif emotion in {"sadness", "fear", "anger"}:
        response = (
            "Thank you for sharing this. A CBT step you can try: identify the strongest thought "
            "behind this feeling, then ask yourself what evidence supports and challenges it. "
            "Would you like to work through that thought together?"
        )
    else:
        response = (
            "You're doing a good job checking in. Let's build resilience with a quick CBT habit: "
            "name one challenge today and one small action you can take in the next hour."
        )

    return {
        "response": response,
        "emotion": emotion,
        "confidence": confidence,
        "escalation_required": escalation_required,
        "risk_probability": risk_probability,
    }
