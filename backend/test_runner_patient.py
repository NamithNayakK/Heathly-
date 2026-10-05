import sys
import os
import requests
import json

import time

BASE_URL = "http://127.0.0.1:8000"

def run_step_1_patient():
    print("--- [PATIENT] Registering & Logging in ---", flush=True)
    ts = int(time.time())
    p_email = f"patient_{ts}@healthly.com"
    p_pass = "Patient123!"
    
    # Try register
    r_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": p_email,
        "password": p_pass,
        "full_name": "Test Patient",
        "role": "patient"
    })
    print(f"Register status: {r_reg.status_code}", flush=True)
    
    # Login
    r_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": p_email,
        "password": p_pass
    })
    print(f"Login status: {r_login.status_code}", flush=True)
    assert r_login.status_code == 200, r_login.text
    token = r_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get user id
    me_res = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
    p_id = me_res.json()["id"]

    # 1. Telemetry / Sensors
    print("--- [PATIENT] Submitting Telemetry (Manual Google Fit) ---", flush=True)
    sensor_res = requests.post(f"{BASE_URL}/api/auth/google-fit/manual?user_id={p_id}", json={
        "steps": 8500,
        "sleep_hours": 7.2,
        "heart_rate": 74
    }, headers=headers)
    print(f"Telemetry submission: {sensor_res.status_code} -> {sensor_res.json()}", flush=True)
    assert sensor_res.status_code == 200
    
    # Verify latest reading
    latest_res = requests.get(f"{BASE_URL}/api/users/{p_id}/latest", headers=headers)
    print(f"Latest Telemetry: {latest_res.status_code} -> {latest_res.json()}", flush=True)
    assert latest_res.json().get("steps") == 8500
    
    # 2. PHQ-9 Assessment
    print("--- [PATIENT] Submitting PHQ-9 Assessment ---", flush=True)
    phq9_res = requests.post(f"{BASE_URL}/api/v1/assessment/phq9", json={
        "answers": [1, 2, 1, 2, 0, 1, 2, 1, 0] # Score = 10 (Moderate)
    }, headers=headers)
    print(f"PHQ-9 submission: {phq9_res.status_code} -> {phq9_res.json().get('score')}, risk: {phq9_res.json().get('risk_level')}", flush=True)
    assert phq9_res.status_code == 200
    assessment_id = phq9_res.json().get("id")
    
    # 3. PHQ-9 History
    print("--- [PATIENT] Fetching Assessment History ---", flush=True)
    hist_res = requests.get(f"{BASE_URL}/api/v1/assessment/phq9/history", headers=headers)
    print(f"PHQ-9 history count: {len(hist_res.json().get('items', []))}", flush=True)
    assert len(hist_res.json().get("items", [])) >= 1
    
    # 4. Chatbot
    print("--- [PATIENT] Testing Chatbot Endpoint ---", flush=True)
    chat_res = requests.post(f"{BASE_URL}/api/v1/chat/message", json={
        "message": "Hello, I am feeling a bit stressed today."
    }, headers=headers)
    print(f"Chatbot response: {chat_res.status_code}", flush=True)
    assert chat_res.status_code == 200
    
    # 5. Multimodal Dashboard
    print("--- [PATIENT] Testing Multimodal Dashboard ---", flush=True)
    dash_res = requests.get(f"{BASE_URL}/api/v1/multimodal/dashboard", headers=headers)
    print(f"Multimodal Dashboard status: {dash_res.status_code}, body: {dash_res.text[:200]}", flush=True)
    assert dash_res.status_code == 200

    print(">>> ALL PATIENT TESTS PASSED SUCCESSFULLY! <<<", flush=True)
    return p_email, token

if __name__ == "__main__":
    run_step_1_patient()
