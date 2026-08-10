import httpx
from app.core.config import settings


async def trigger_n8n_workflow(webhook_path: str, data: dict) -> dict:
    """
    Trigger an n8n workflow by sending a POST request to the webhook URL.
    webhook_path: e.g., "webhook/risk-alert" or "webhook/daily-digest"
    """
    webhook_url = f"{settings.n8n_webhook_url}/{webhook_path}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=data, timeout=5.0)
            response.raise_for_status()
            return {"success": True, "message": "Workflow triggered", "response": response.json()}
    except httpx.RequestError as exc:
        return {"success": False, "message": f"Failed to trigger workflow: {str(exc)}"}

async def send_webhook_to_n8n_new_user(user_id: int, email: str, full_name: str) -> dict:
    payload = {
        "user_id": user_id,
        "email": email,
        "full_name": full_name,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }
    return await trigger_n8n_workflow("webhook/new-user", payload)


async def send_webhook_to_n8n_risk_alert(
    user_id: int,
    email: str,
    full_name: str,
    phq9_score: int,
    risk_level: str,
    dominant_emotion: str = None,
    concern_areas: list = None,
    is_unassigned: bool = False,
) -> dict:
    """
    Trigger Workflow 1: High-Risk Escalation Alert in n8n.
    """
    payload = {
        "user_id": user_id,
        "email": email,
        "full_name": full_name,
        "score": phq9_score,
        "phq9_score": phq9_score,
        "risk_level": risk_level,
        "dominant_emotion": dominant_emotion or "N/A",
        "concern_areas": concern_areas or [],
        "is_unassigned": is_unassigned,
        "urgent_fallback_required": is_unassigned and ("high" in risk_level.lower() or "severe" in risk_level.lower()),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }

    return await trigger_n8n_workflow("webhook/risk-alert", payload)



async def send_webhook_to_n8n_daily_digest() -> dict:
    """
    Trigger Workflow 2: Daily Risk Summary Digest in n8n.
    """
    payload = {
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        "requested_by": "system_admin"
    }

    return await trigger_n8n_workflow("webhook/daily-digest", payload)


async def send_webhook_to_n8n_forum_moderation(
    post_id: int,
    title: str = None,
    content: str = None,
    author_name: str = None,
    author_email: str = None,
    reason: str = None
) -> dict:
    """
    Trigger Workflow 3: Forum Moderation Alert in n8n.
    """
    payload = {
        "post_id": post_id,
        "title": title,
        "content": content,
        "author_name": author_name,
        "author_email": author_email,
        "reason": reason or "Flagged by User",
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }

    return await trigger_n8n_workflow("webhook/forum-moderation", payload)


async def send_webhook_to_n8n_google_fit_sync(user_id: int, step_count: int = None, heart_rate: float = None) -> dict:
    """
    Trigger Workflow 4: Google Fit Sync in n8n.
    """
    payload = {
        "user_id": user_id,
        "step_count": step_count,
        "heart_rate": heart_rate,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }

    return await trigger_n8n_workflow("webhook/google-fit-sync", payload)
