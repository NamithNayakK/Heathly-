import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_live_sensor_pipeline():
    print("=========================================================")
    print("TESTING LIVE SENSOR TELEMETRY PIPELINE (HTTP)")
    print(f"Target Server: {BASE_URL}")
    print("=========================================================\n")

    # 1. Login user namith@gmail.com
    print("[1] LOGGING IN...")
    login_payload = {
        "email": "namith@gmail.com",
        "password": "123456789"
    }
    res = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_payload)
    if res.status_code != 200:
        print(f"    Login failed (HTTP {res.status_code}). Registering user...")
        reg_res = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
            "email": "namith@gmail.com",
            "password": "123456789",
            "full_name": "Namith",
            "role": "patient"
        })
        print(f"    Registration: HTTP {reg_res.status_code}")
        res = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_payload)

    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"    [OK] Logged in successfully! Token: {token[:25]}...\n")

    # 2. Check Google Fit Status
    print("[2] CHECKING GOOGLE FIT STATUS...")
    status_res = requests.get(f"{BASE_URL}/api/v1/auth/google-fit/status", headers=headers)
    print(f"    [OK] Status: HTTP {status_res.status_code} -> {status_res.json()}\n")

    # 3. Post Manual Sensor Fallback Entry
    print("[3] POSTING MANUAL SENSOR TELEMETRY...")
    manual_payload = {
        "steps": 9500,
        "sleep_hours": 8.2,
        "heart_rate": 68
    }
    manual_res = requests.post(f"{BASE_URL}/api/v1/auth/google-fit/manual", json=manual_payload, headers=headers)
    assert manual_res.status_code == 200, f"Manual telemetry failed: {manual_res.text}"
    print(f"    [OK] Manual Entry Result: {manual_res.json()}\n")

    # 4. Post Live Phone/WiFi Sensor Telemetry
    print("[4] POSTING LIVE PHONE/WIFI SENSOR DATA (/api/sensor-data)...")
    sensor_payload = {
        "user_id": "namith_device_001",
        "timestamp": datetime.utcnow().isoformat(),
        "activity": {
            "steps": 10200,
            "distance_meters": 7500.0,
            "calories": 520.0,
            "active_minutes": 65
        },
        "screen": {
            "is_screen_on": True,
            "screen_time_today_minutes": 150,
            "brightness_level": 70,
            "unlock_count": 18
        },
        "heart": {
            "heart_rate_bpm": 65,
            "resting_heart_rate": 60,
            "hrv_ms": 58.0
        },
        "sleep": {
            "last_sleep_duration_hours": 8.2,
            "last_sleep_quality_percent": 90,
            "bedtime": "22:30",
            "wake_time": "06:42"
        },
        "battery": {
            "level_percent": 92,
            "is_charging": False,
            "temperature": 29.8
        },
        "app_usage": {
            "current_app": "com.healthly.app",
            "social_app_minutes_today": 30,
            "productivity_app_minutes_today": 150,
            "entertainment_app_minutes_today": 20
        },
        "network": {
            "connection_type": "wifi",
            "wifi_ssid": "Healthly_Office_5G"
        },
        "notifications": {
            "count_last_hour": 3,
            "social_notifications_count": 1
        },
        "location": {
            "unique_locations_today": 2,
            "is_at_home": True
        },
        "consent_given": True
    }
    sensor_headers = {"X-API-Key": "healthly_wifi_secret"}
    sensor_res = requests.post(f"{BASE_URL}/api/sensor-data", json=sensor_payload, headers=sensor_headers)
    assert sensor_res.status_code == 200, f"Sensor data submission failed: {sensor_res.text}"
    print(f"    [OK] Sensor Telemetry Submission Result: {sensor_res.json()}\n")

    # 5. Fetch Latest Sensor Metrics
    print("[5] FETCHING LATEST SENSOR METRICS FOR USER...")
    latest_res = requests.get(f"{BASE_URL}/api/users/namith@gmail.com/latest", headers=headers)
    assert latest_res.status_code == 200, f"Fetch latest failed: {latest_res.text}"
    latest = latest_res.json()
    print(f"    [OK] Latest Sensor Metrics:")
    print(f"        - Steps: {latest.get('steps')}")
    print(f"        - Sleep Duration: {latest.get('sleep_hours')} hours")
    print(f"        - Heart Rate: {latest.get('heart_rate')} bpm (HRV: {latest.get('hrv')} ms)")
    print(f"        - Screen Time: {latest.get('screen_time_minutes')} minutes")
    print(f"        - WiFi SSID: {latest.get('wifi_ssid')}")
    print(f"        - Data Source: {latest.get('data_source')}\n")

    # 6. Fetch Risk Assessment & Recommendations
    print("[6] FETCHING MENTAL HEALTH RISK & RECOMMENDATIONS...")
    risk_res = requests.get(f"{BASE_URL}/api/users/namith_device_001/risk", headers=headers)
    print(f"    [OK] Risk Assessment: {risk_res.json()}")

    recs_res = requests.get(f"{BASE_URL}/api/users/namith_device_001/recommendations", headers=headers)
    print(f"    [OK] Personalized Recommendations ({len(recs_res.json())} items):")
    for r in recs_res.json():
        print(f"        * [{r.get('type')}] {r.get('title')}: {r.get('message')}")

    print("\n=========================================================")
    print("LIVE SENSOR TELEMETRY PIPELINE TEST COMPLETED SUCCESSFULLY!")
    print("=========================================================")

if __name__ == "__main__":
    test_live_sensor_pipeline()
