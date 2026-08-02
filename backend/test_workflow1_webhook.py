import asyncio
import httpx
import json

async def test_webhook():
    webhook_url = "http://localhost:5678/webhook/risk-alert"
    payload = {
        "user_id": 4,
        "risk_level": "High",
        "score": 22,
        "dominant_emotion": "Severe Anxiety",
        "concern_areas": ["Depression", "Suicidal Ideation", "Emotional Distress"],
        "timestamp": "2026-07-29T21:16:18Z"
    }

    print(f"Triggering n8n High-Risk Escalation Alert webhook at {webhook_url}...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(webhook_url, json=payload, timeout=10.0)
            print(f"HTTP Status Code: {response.status_code}")
            print(f"Response Content: {response.text}")
            return response.status_code == 200
        except Exception as e:
            print(f"Error calling webhook: {e}")
            return False

if __name__ == "__main__":
    asyncio.run(test_webhook())
