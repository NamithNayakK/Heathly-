"""
Multimodal Mental Wellness Chatbot — 4-in-1 Single Routed System

Architecture:
1. SAFETY/CRISIS CHECK (runs FIRST, unconditionally on EVERY message, no exceptions)
   - Combination of fast regex/keyword pattern matching AND DistilBERT emotion classifier.
   - Triggers CRISIS TRIAGE MODE instantly if self-harm / suicide / crisis language is detected.
   - Overrides all other routing. Sets escalation_required=True.

2. CRISIS TRIAGE MODE
   - Pre-approved, calm, validating template with verified Indian helplines (Tele-MANAS, KIRAN, iCall, AASRA).
   - Never attempts to "handle" crisis conversationally — acts as a safe bridge to human care.
   - Triggers human review escalation pipeline.

3. INTENT ROUTER (only runs if crisis check did NOT trigger)
   - Classifies message into: "check-in", "coping-request", or "general".

4. STRUCTURED CHECK-IN MODE
   - Asks clarifying questions for vague mood entries.
   - Logs mood entry and derives wellness index.

5. CBT COPING MODE
   - Offers ONE specific, named technique per response (5-4-3-2-1 Grounding, Thought Record, Box Breathing, etc.).
   - Explicitly avoids diagnostic language (describes feelings, never labels conditions).
   - Includes periodic soft disclaimer.

6. GENERAL COMPANION MODE
   - Warm, conversational, uses DistilBERT emotion signal to shape tone.
   - Default fallback mode.
"""

import re
import random
from typing import Dict, Any, Optional, Tuple

from app.services.emotion_classifier import analyze_emotion
from app.services.llm_service import llm_classify_intent, llm_generate_response

# --- CRISIS RECOGNITION PATTERNS & KEYWORDS ---

CRISIS_REGEX_PATTERNS = [
    r"\b(suicide|suicidal)\b",
    r"\bself[- ]harm(ing)?\b",
    r"\bkill\s+(myself|me)\b",
    r"\bend\s+my\s+life\b",
    r"\bending\s+my\s+life\b",
    r"\bwant\s+to\s+die\b",
    r"\bwanting\s+to\s+die\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\bcan'?t\s+go\s+on\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bcut\s+(myself|my\s+wrists?)\b",
    r"\bhang\s+myself\b",
    r"\bpoison\s+myself\b",
    r"\btake\s+all\s+my\s+pills\b",
    r"\bdon'?t\s+want\s+to\s+be\s+here\s+anymore\b",
    r"\bdon'?t\s+want\s+to\s+live\b",
]

DISTRESS_SECONDARY_KEYWORDS = {
    "hopeless", "worthless", "despair", "give up on life", "no hope left", "end it all"
}

# --- PRE-APPROVED CRISIS TRIAGE TEMPLATE ---

CRISIS_TRIAGE_TEMPLATE = (
    "I hear that you're in a very painful place right now, and I want you to know that you are not alone. "
    "Because your safety is the absolute highest priority, I have flagged this for immediate review by your assigned care consultant.\n\n"
    "Please reach out to a trusted loved one or contact a confidential 24/7 crisis helpline right away:\n"
    "• Tele-MANAS (Govt. of India): 14416 or 1800-891-4416 (Toll-Free, 24/7)\n"
    "• KIRAN Mental Health Helpline: 1800-599-0019 (Toll-Free, 24/7)\n"
    "• iCall (TISS): +91-9152987821 (Mon-Sat 10:00 AM - 8:00 PM)\n"
    "• Vandrevala Foundation: +91-9999666555 (24/7)\n"
    "• AASRA Helpline: +91-9820466726 (24/7)\n\n"
    "If you are in immediate physical danger, please call your local emergency services (112) or go to the nearest hospital emergency room. "
    "Please stay safe — support is available right now."
)

# --- CBT SPECIFIC NAMED TECHNIQUES ---

CBT_TECHNIQUES = {
    "grounding": {
        "name": "5-4-3-2-1 Sensory Grounding Technique",
        "instruction": (
            "When thoughts feel overwhelming, grounding brings focus back to the present moment. "
            "Try this 5-step sensory scan right now:\n"
            "1. 👁️ Look around and name 5 things you can see.\n"
            "2. ✋ Touch 4 things around you (feel their texture or temperature).\n"
            "3. 👂 Listen for 3 distinct sounds around you.\n"
            "4. 👃 Notice 2 things you can smell.\n"
            "5. 👅 Identify 1 thing you can taste.\n\n"
            "Take a deep breath after each step. How does your body feel as you notice your surroundings?"
        )
    },
    "thought_record": {
        "name": "Cognitive Thought Record (Evidence For & Against)",
        "instruction": (
            "When thoughts spin quickly, examining them objectively helps reduce their weight. "
            "Let's break it down into 3 simple questions:\n"
            "1. What is the specific thought causing distress right now?\n"
            "2. What objective facts support this thought?\n"
            "3. What objective facts challenge or contradict this thought?\n\n"
            "Often, looking at the evidence reveals a more balanced perspective than the initial reaction."
        )
    },
    "box_breathing": {
        "name": "Box Breathing (4-4-4-4 Technique)",
        "instruction": (
            "To steady your nervous system when feeling heightened tension, try 4 cycles of Box Breathing:\n"
            "1. 📥 Inhale slowly through your nose for 4 seconds.\n"
            "2. ⏸️ Hold your breath for 4 seconds.\n"
            "3. 📤 Exhale gently through your mouth for 4 seconds.\n"
            "4. ⏸️ Pause and hold for 4 seconds.\n\n"
            "Repeat this pattern 4 times. Focus entirely on the counting rhythm."
        )
    },
    "behavioral_activation": {
        "name": "Behavioral Activation (Micro-Step Rule)",
        "instruction": (
            "When feeling low energy or stuck, large tasks can feel insurmountable. "
            "The micro-step rule asks for the smallest imaginable action:\n"
            "Pick ONE tiny action taking less than 2 minutes (e.g. drinking a glass of water, opening a window, or stretching your arms).\n\n"
            "Action often precedes motivation. What is one micro-step you can take right now?"
        )
    },
    "worry_time": {
        "name": "Worry Postponement Protocol",
        "instruction": (
            "When persistent worries interfere with your day, try scheduling dedicated 'Worry Time':\n"
            "1. Set a 15-minute window later today (e.g. 5:00 PM - 5:15 PM) specifically for worrying.\n"
            "2. When a troubling thought occurs now, write it down on paper and tell yourself: 'I will address this at 5:00 PM.'\n"
            "3. Return your attention to the current task.\n\n"
            "This gives your mind permission to pause repetitive thoughts without ignoring them."
        )
    }
}

SOFT_DISCLAIMER = "\n\n*Note: This self-guided exercise is an educational wellness tool and does not replace professional medical or psychological evaluation.*"

# Recommended step/activity target used for gentle nudges
_DAILY_STEP_GOAL = 6000
_DAILY_ACTIVE_MINUTES_GOAL = 30
_SEVERE_BANDS = {"Severe", "Moderately Severe"}
_MODERATE_BANDS = {"Moderate"}


def _wellness_percentage(score: Optional[int], max_score: int = 27) -> Optional[int]:
    """Convert a PHQ-9 score (0=best, 27=worst) into a 0-100 wellbeing percentage (100=best)."""
    if score is None:
        return None
    score = max(0, min(max_score, score))
    return round((1 - score / max_score) * 100)


def _check_crisis(message: str, emotion: str, confidence: float) -> Tuple[bool, float]:
    """1. SAFETY/CRISIS CHECK (runs FIRST, unconditionally on every message).

    Returns (is_crisis, risk_probability).
    """
    lowered = message.lower()

    # Direct regex pattern match (checks entire message text)
    regex_hit = any(re.search(pat, lowered) for pat in CRISIS_REGEX_PATTERNS)

    # Secondary distress keywords
    distress_hit = any(kw in lowered for kw in DISTRESS_SECONDARY_KEYWORDS)

    # Emotion signal booster
    high_distress_emotion = emotion in {"sadness", "fear"} and confidence >= 0.70

    if regex_hit:
        return True, 0.99
    if distress_hit and high_distress_emotion:
        return True, 0.85
    if distress_hit:
        return False, 0.55
    if high_distress_emotion:
        return False, 0.35

    return False, 0.05


def _route_intent(message: str, emotion: str) -> str:
    """3. INTENT ROUTER (runs only if crisis check did NOT trigger).

    Classifies message into: 'check-in', 'coping-request', or 'general'.
    """
    lowered = message.lower()

    # Coping request keywords (overriding general text if specific coping trigger present)
    coping_keywords = [
        "overthink", "overthinking", "stop overthinking", "grounding", "coping", "calm down",
        "help me relax", "technique", "exercise", "panic", "breath", "breathing",
        "anxiety exercise", "stress technique", "how to deal with", "how to manage"
    ]
    if any(kw in lowered for kw in coping_keywords):
        return "coping-request"

    # Try LLM classification for broader context
    llm_intent = llm_classify_intent(message)
    if llm_intent in {"check-in", "coping-request", "general"}:
        return llm_intent

    # Check-in keywords fallback
    checkin_keywords = [
        "feeling off", "feeling down", "feeling sad", "feeling anxious", "feeling low",
        "my mood", "mood check", "feeling tired", "overwhelmed today", "feeling exhausted",
        "feeling stressed", "feeling heavy", "feeling uneasy"
    ]
    if any(kw in lowered for kw in checkin_keywords) or emotion in {"sadness", "fear"}:
        return "check-in"

    return "general"


def _handle_checkin_mode(message: str, emotion: str) -> Tuple[str, Optional[str]]:
    """4. STRUCTURED CHECK-IN MODE

    Asks clarifying question if vague, logs mood entry tag.
    Returns (response_text, mood_tag).
    """
    lowered = message.lower()

    if "off" in lowered or "vague" in lowered or message.strip().endswith("off"):
        response = (
            "I hear that you're feeling a bit off today. To help us understand better: "
            "are you feeling physically exhausted, emotionally anxious, or feeling low in spirit? "
            "Sharing a little more helps us tailor our check-in."
        )
        mood_tag = "feeling_off"
    elif "anxious" in lowered or "fear" in emotion:
        response = (
            "Thank you for sharing that you're feeling anxious. "
            "Noticing and naming your emotional state is a valuable first step in self-regulation. "
            "Are you experiencing physical restlessness, or are your thoughts spinning fast?"
        )
        mood_tag = "anxious"
    elif "down" in lowered or "sad" in lowered or "sadness" in emotion:
        response = (
            "I appreciate you checking in about feeling low today. "
            "It's completely valid to have days when your energy and mood are down. "
            "Would you like to log this in your daily mood journal, or try a quick calming exercise?"
        )
        mood_tag = "low_mood"
    else:
        response = (
            "Thanks for checking in today. Keeping track of your daily emotional rhythm builds great self-awareness. "
            "How has your energy level been throughout the day?"
        )
        mood_tag = "general_checkin"

    return response, mood_tag


def _handle_coping_mode(message: str) -> str:
    """5. CBT COPING MODE

    Offers ONE specific, named technique per response.
    Explicitly avoids diagnostic labels. Includes soft disclaimer.
    """
    lowered = message.lower()

    if "overthink" in lowered or "thought" in lowered:
        tech = CBT_TECHNIQUES["thought_record"]
    elif "breath" in lowered or "calm" in lowered or "panic" in lowered:
        tech = CBT_TECHNIQUES["box_breathing"]
    elif "energy" in lowered or "low" in lowered or "stuck" in lowered:
        tech = CBT_TECHNIQUES["behavioral_activation"]
    elif "worry" in lowered:
        tech = CBT_TECHNIQUES["worry_time"]
    else:
        tech = CBT_TECHNIQUES["grounding"]

    response = (
        f"Here is ONE specific, structured technique you can practice right now:\n\n"
        f"📌 **{tech['name']}**\n\n"
        f"{tech['instruction']}"
        f"{SOFT_DISCLAIMER}"
    )
    return response


def _handle_general_mode(message: str, emotion: str) -> str:
    """6. GENERAL COMPANION MODE

    Warm, conversational, uses DistilBERT emotion signal to shape tone.
    """
    if emotion == "sadness":
        return (
            "I'm here with you. It sounds like things feel a bit heavy right now. "
            "Take your time, and let me know if you'd like to talk through what's on your mind or try a grounding exercise."
        )
    elif emotion == "fear":
        return (
            "I hear you. When things feel uncertain, it's natural to feel tense. "
            "Remember to take slow, gentle breaths. I'm right here whenever you want to share more."
        )
    elif emotion == "anger":
        return (
            "I hear your frustration. It takes strength to express strong emotions cleanly. "
            "I'm listening if you want to vent or explore what triggered this."
        )
    elif emotion == "joy":
        return (
            "It's wonderful to hear positive energy in your message! "
            "Celebrating small bright spots is fantastic for emotional wellbeing."
        )
    else:
        return (
            "Hello! I'm your Healthly companion. I'm here to support your mental wellness check-ins, "
            "guided CBT coping exercises, and daily tracking. How can I help you today?"
        )


def _doctor_line(risk_level: Optional[str]) -> Tuple[Optional[str], bool, bool]:
    """Returns (line, suggest_doctor, urgent_doctor) based on PHQ-9 risk band."""
    if not risk_level:
        return None, False, False

    if risk_level in _SEVERE_BANDS:
        return (
            "Based on your last assessment, you're in the severe depression range. Please contact "
            "a doctor immediately - I can arrange a video meeting with a specialist for you right now.",
            True,
            True,
        )
    if risk_level in _MODERATE_BANDS:
        return (
            "Your last assessment placed you in the moderate depression range. It could really help to "
            "connect with a doctor for proper support - I can set up a video call whenever you're ready.",
            True,
            False,
        )
    return None, False, False


def generate_cbt_response(
    message: str,
    phq9_context: Optional[dict] = None,
    sensor_context: Optional[dict] = None,
) -> dict:
    """Main chatbot orchestrator implementing the 4-in-1 routed architecture.

    Order of operations:
    1. SAFETY/CRISIS CHECK (runs FIRST, unconditionally on EVERY message)
    2. CRISIS TRIAGE MODE (if crisis flagged)
    3. INTENT ROUTER (if safe)
    4. MODE EXECUTION (Check-in, CBT Coping, or General Companion)
    """
    emotion, confidence = analyze_emotion(message)

    # 1. SAFETY/CRISIS CHECK (unconditional, runs first on every message)
    is_crisis, risk_probability = _check_crisis(message, emotion, confidence)

    if is_crisis:
        # 2. CRISIS TRIAGE MODE
        risk_level = (phq9_context or {}).get("risk_level") or "High Risk"
        return {
            "response": CRISIS_TRIAGE_TEMPLATE,
            "emotion": emotion,
            "confidence": confidence,
            "escalation_required": True,
            "risk_probability": risk_probability,
            "mode": "crisis_triage",
            "risk_level": risk_level,
            "wellness_percentage": _wellness_percentage((phq9_context or {}).get("score")),
            "suggest_doctor": True,
            "urgent_doctor": True,
            "sensor_connected": bool((sensor_context or {}).get("connected")),
            "steps_today": (sensor_context or {}).get("steps"),
            "active_minutes_today": (sensor_context or {}).get("active_minutes"),
            "activity_suggestion": None,
        }

    # 3. INTENT ROUTER (safe path)
    mode = _route_intent(message, emotion)

    mood_tag = None
    llm_resp = llm_generate_response(mode, message, emotion, confidence)

    if mode == "check-in":
        fallback_text, mood_tag = _handle_checkin_mode(message, emotion)
        response_text = llm_resp if llm_resp else fallback_text
    elif mode == "coping-request":
        fallback_text = _handle_coping_mode(message)
        # Ensure coping response contains a named technique or fallback
        if llm_resp and any(kw in llm_resp for kw in ["Technique", "Grounding", "Record", "Breathing", "Activation", "Protocol", "Exercise"]):
            response_text = llm_resp
        else:
            response_text = fallback_text
    else:  # "general"
        fallback_text = _handle_general_mode(message, emotion)
        response_text = llm_resp if llm_resp else fallback_text

    # Optional doctor / activity context overlays
    risk_level = (phq9_context or {}).get("risk_level")
    _, suggest_doctor, urgent_doctor = _doctor_line(risk_level)

    return {
        "response": response_text,
        "emotion": emotion,
        "confidence": confidence,
        "escalation_required": False,
        "risk_probability": risk_probability,
        "mode": mode,
        "mood_tag": mood_tag,
        "risk_level": risk_level,
        "wellness_percentage": _wellness_percentage((phq9_context or {}).get("score")),
        "suggest_doctor": suggest_doctor,
        "urgent_doctor": urgent_doctor,
        "sensor_connected": bool((sensor_context or {}).get("connected")),
        "steps_today": (sensor_context or {}).get("steps"),
        "active_minutes_today": (sensor_context or {}).get("active_minutes"),
        "activity_suggestion": None,
    }


def get_companion_status(phq9_context: Optional[dict], sensor_context: Optional[dict]) -> dict:
    """Lightweight status snapshot used to populate the wellness widget on page load."""
    risk_level = (phq9_context or {}).get("risk_level")
    _, suggest_doctor, urgent_doctor = _doctor_line(risk_level)

    return {
        "risk_level": risk_level,
        "wellness_percentage": _wellness_percentage((phq9_context or {}).get("score")),
        "suggest_doctor": suggest_doctor,
        "urgent_doctor": urgent_doctor,
        "sensor_connected": bool((sensor_context or {}).get("connected")),
        "steps_today": (sensor_context or {}).get("steps"),
        "active_minutes_today": (sensor_context or {}).get("active_minutes"),
        "activity_suggestion": None,
    }
