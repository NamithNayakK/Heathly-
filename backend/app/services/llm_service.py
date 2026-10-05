"""
LLM Service for Multimodal Mental Wellness Chatbot.
Integrates Groq / Claude API for intent classification and mode response generation
with strict safety guardrails, medical boundary constraints, and deterministic fallbacks.
"""

import httpx
from typing import Optional, Tuple
from app.core.config import settings

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "groq/compound-mini"

SYSTEM_PROMPT = """You are Healthly Companion, an AI wellness assistant.
Your instructions are strict and mandatory:
1. NEVER give medical or psychological diagnoses (do not say "you have anxiety", "you are depressed", etc.).
2. NEVER claim to be a licensed therapist, doctor, or medical professional.
3. NEVER discourage seeking real human help or professional care.
4. Focus on validating feelings, describing emotional states, and providing self-guided wellbeing exercises.
5. If in CBT Coping mode, offer ONE specific, named technique per response (e.g., "5-4-3-2-1 Sensory Grounding", "Cognitive Thought Record").
6. Keep responses warm, concise, and structured.
"""

INTENT_ROUTER_PROMPT = """Classify the user's message into EXACTLY ONE of the following 3 categories:
- "check-in" (user is describing their current mood, emotional state, or daily check-in, e.g., "feeling off", "feeling anxious today", "low energy")
- "coping-request" (user is explicitly or implicitly asking for a coping mechanism, technique, or help managing stress/thoughts/panic, e.g., "how to stop overthinking", "help me calm down", "give me a technique")
- "general" (casual greetings, general conversation, or non-wellness chat, e.g., "hi", "how are you", "what can you do")

Reply with ONLY the category string ("check-in", "coping-request", or "general") and nothing else.
"""

def generate_llm_completion(system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 400) -> Optional[str]:
    """Synchronous completion call to Groq API with short timeout and exception safety."""
    if not settings.groq_api_key:
        return None

    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.post(GROQ_ENDPOINT, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                return content
            else:
                # Log or print error code silently for fallback
                print(f"[LLMService] API error code {resp.status_code}: {resp.text}")
                return None
    except Exception as exc:
        print(f"[LLMService] Request exception: {exc}")
        return None


def llm_classify_intent(user_message: str) -> Optional[str]:
    """Classify message intent via LLM."""
    result = generate_llm_completion(
        system_prompt=INTENT_ROUTER_PROMPT,
        user_prompt=f"User message: \"{user_message}\"",
        temperature=0.0,
        max_tokens=20
    )
    if not result:
        return None
    
    clean = result.lower().strip().replace('"', '').replace("'", "")
    if "coping" in clean:
        return "coping-request"
    elif "check-in" in clean or "checkin" in clean or "mood" in clean:
        return "check-in"
    elif "general" in clean:
        return "general"
    return None


def llm_generate_response(mode: str, user_message: str, emotion: str, confidence: float) -> Optional[str]:
    """Generate mode-specific response using LLM adhering to system guidelines."""
    mode_prompt = f"Target Mode: {mode}\nDetected User Emotion: {emotion} (confidence: {confidence:.2f})\nUser Message: \"{user_message}\"\n\nGenerate the companion response adhering strictly to all safety constraints."
    
    if mode == "coping-request":
        mode_prompt += "\nREMINDER: Include ONE specific named technique (e.g. 5-4-3-2-1 Grounding, Thought Record, or Box Breathing), describe steps clearly, and include the soft disclaimer at the end."
    elif mode == "check-in":
        mode_prompt += "\nREMINDER: Ask a brief clarifying question if mood is vague or validate the emotion softly."
    elif mode == "general":
        mode_prompt += "\nREMINDER: Be warm and conversational, using the detected emotion to shape a gentle tone."

    return generate_llm_completion(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=mode_prompt,
        temperature=0.4,
        max_tokens=450
    )
