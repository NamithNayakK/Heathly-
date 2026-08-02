import sys
import os
import logging
from datetime import datetime

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal, engine, Base
from app.models.user import User
from app.models.wifi_sensor import SensorReading, RiskHistory
from app.core.security import get_password_hash, verify_password, encrypt_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_sensor_google_fit")

client = TestClient(app)

def run_tests():
    print("=========================================================")
    print("STARTING END-TO-END SENSOR & GOOGLE FIT TESTS FOR USER")
    print("User Email: namith@gmail.com")
    print("Password:   123456789")
    print("=========================================================\n")

    db: Session = SessionLocal()
    target_email = "namith@gmail.com"
    target_password = "123456789"

    try:
        # STEP 1: User Account Setup / Authentication
        print("[1] AUTHENTICATION TEST")
        user = db.query(User).filter(User.email == target_email).first()
        if not user:
            print(f"    User {target_email} not found in DB. Registering new user account...")
            reg_res = client.post(
                "/api/v1/auth/register",
                json={
                    "email": target_email,
                    "password": target_password,
                    "full_name": "Namith",
                    "role": "patient"
                }
            )
            assert reg_res.status_code in [200, 201], f"Registration failed: {reg_res.text}"
            user = db.query(User).filter(User.email == target_email).first()
            user.device_id = "namith_device_001"
            db.commit()
            db.refresh(user)
            print(f"    [OK] Account created successfully! User ID: {user.id}")
        else:
            print(f"    [OK] Found existing user in DB (User ID: {user.id}). Updating password & device_id...")
            user.hashed_password = get_password_hash(target_password)
            if not user.device_id:
                user.device_id = "namith_device_001"
            db.commit()
            db.refresh(user)

        # Log in via /api/v1/auth/login endpoint
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": target_email, "password": target_password}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token_data = login_res.json()
        token = token_data.get("access_token")
        assert token, "No access token returned!"
        print(f"    [OK] Login successful! User: {token_data.get('user_email')} | Role: {token_data.get('role')}")
        print(f"    [OK] Access Token: {token[:25]}...\n")

        headers = {"Authorization": f"Bearer {token}"}

        # STEP 2: GOOGLE FIT CONNECT OAUTH URL TEST
        print("[2] GOOGLE FIT CONNECT OAUTH URL TEST")
        connect_res = client.get(
            f"/api/v1/auth/google-fit/connect?user_id={user.id}",
            follow_redirects=False
        )
        assert connect_res.status_code in [302, 307], f"Expected redirect, got {connect_res.status_code}"
        redirect_location = connect_res.headers.get("location", "")
        print(f"    [OK] OAuth Redirect URL generated: {redirect_location[:75]}...")
        assert "accounts.google.com" in redirect_location
        assert "scope=" in redirect_location
        assert "access_type=offline" in redirect_location
        print("    [OK] Google Fit Connect OAuth URL parameters verified!\n")

        # STEP 3: GOOGLE FIT STATUS TEST (BEFORE & AFTER SYNC)
        print("[3] GOOGLE FIT STATUS TEST")
        status_res = client.get(f"/api/v1/auth/google-fit/status?user_id={user.id}", headers=headers)
        assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
        status_data = status_res.json()
        print(f"    [OK] Initial Google Fit Status response: {status_data}")

        # Simulate Google Fit token connection for full pipeline testing
        user.google_fit_refresh_token = encrypt_token("mock_google_fit_refresh_token_12345")
        user.google_fit_connected_at = datetime.utcnow()
        user.google_fit_last_sync = datetime.utcnow()
        db.commit()
        db.refresh(user)

        status_res_after = client.get(f"/api/v1/auth/google-fit/status?user_id={user.id}", headers=headers)
        assert status_res_after.status_code == 200
        print(f"    [OK] Connected Google Fit Status response: {status_res_after.json()}\n")

        # STEP 4: GOOGLE FIT PULL-NOW API TEST
        print("[4] GOOGLE FIT PULL-NOW API TEST")
        pull_res = client.post(f"/api/v1/auth/google-fit/pull-now?user_id={user.id}", headers=headers)
        assert pull_res.status_code == 200, f"Pull now failed: {pull_res.text}"
        pull_data = pull_res.json()
        print(f"    [OK] Pull-Now result: status={pull_data.get('status')}, message='{pull_data.get('message')}'\n")

        # STEP 5: MANUAL SENSOR TELEMETRY FALLBACK TEST
        print("[5] MANUAL SENSOR ENTRY FALLBACK TEST")
        manual_payload = {
            "steps": 8500,
            "sleep_hours": 7.5,
            "heart_rate": 72
        }
        manual_res = client.post(
            f"/api/v1/auth/google-fit/manual?user_id={user.id}",
            json=manual_payload,
            headers=headers
        )
        assert manual_res.status_code == 200, f"Manual sensor entry failed: {manual_res.text}"
        manual_data = manual_res.json()
        print(f"    [OK] Manual Entry Result: status={manual_data.get('status')}")
        print(f"    [OK] Saved Telemetry Data: {manual_data.get('data')}\n")

        # STEP 6: PHONE WIFI SENSOR DATA TELEMETRY TEST
        print("[6] PHONE WIFI SENSOR TELEMETRY TEST (/api/sensor-data)")
        phone_sensor_payload = {
            "user_id": user.device_id,
            "timestamp": datetime.utcnow().isoformat(),
            "activity": {
                "steps": 9200,
                "distance_meters": 6800.0,
                "calories": 450.0,
                "active_minutes": 55
            },
            "screen": {
                "is_screen_on": False,
                "screen_time_today_minutes": 180,
                "brightness_level": 60,
                "unlock_count": 24
            },
            "heart": {
                "heart_rate_bpm": 68,
                "resting_heart_rate": 62,
                "hrv_ms": 52.5
            },
            "sleep": {
                "last_sleep_duration_hours": 8.0,
                "last_sleep_quality_percent": 88,
                "bedtime": "23:00",
                "wake_time": "07:00"
            },
            "battery": {
                "level_percent": 85,
                "is_charging": False,
                "temperature": 31.5
            },
            "app_usage": {
                "current_app": "com.healthly.app",
                "social_app_minutes_today": 45,
                "productivity_app_minutes_today": 120,
                "entertainment_app_minutes_today": 30
            },
            "network": {
                "connection_type": "wifi",
                "wifi_ssid": "Home_Mesh_5G"
            },
            "notifications": {
                "count_last_hour": 5,
                "social_notifications_count": 2
            },
            "location": {
                "unique_locations_today": 3,
                "is_at_home": True
            },
            "consent_given": True
        }

        sensor_headers = {"X-API-Key": "healthly_wifi_secret"}
        sensor_res = client.post(
            "/api/sensor-data",
            json=phone_sensor_payload,
            headers=sensor_headers
        )
        assert sensor_res.status_code == 200, f"Sensor data post failed: {sensor_res.text}"
        sensor_data = sensor_res.json()
        print(f"    [OK] Phone WiFi Sensor telemetry saved! Response: {sensor_data}\n")

        # STEP 7: SENSOR DATA VERIFICATION ENDPOINTS
        print("[7] SENSOR DATA VERIFICATION ENDPOINTS")

        # 7a. Get Latest Reading
        latest_res = client.get(f"/api/users/{target_email}/latest", headers=headers)
        assert latest_res.status_code == 200, f"Get latest reading failed: {latest_res.text}"
        latest_info = latest_res.json()
        print(f"    [OK] Latest Sensor Reading for {target_email}:")
        print(f"        - Steps: {latest_info.get('steps')}")
        print(f"        - Sleep Hours: {latest_info.get('sleep_hours')}")
        print(f"        - Heart Rate: {latest_info.get('heart_rate')} bpm")
        print(f"        - Screen Time: {latest_info.get('screen_time_minutes')} mins")
        print(f"        - Data Source: {latest_info.get('data_source')}")

        # 7b. Get Sensor History
        history_res = client.get(f"/api/users/{target_email}/history?limit=10", headers=headers)
        assert history_res.status_code == 200
        history_data = history_res.json()
        print(f"    [OK] Sensor History records retrieved: {len(history_data)} entries")

        # 7c. Get Current Mental Health Risk Assessment
        risk_res = client.get(f"/api/users/{user.device_id}/risk", headers=headers)
        assert risk_res.status_code == 200
        risk_info = risk_res.json()
        print(f"    [OK] Mental Health Risk Assessment:")
        print(f"        - Risk Level: {risk_info.get('risk_level')}")
        print(f"        - Risk Score: {risk_info.get('risk_score')}")
        print(f"        - Confidence: {risk_info.get('confidence')}")
        print(f"        - Contributing Factors: {risk_info.get('contributing_factors')}")

        # 7d. Get Sensor Trends
        trends_res = client.get(f"/api/users/{user.device_id}/trends", headers=headers)
        assert trends_res.status_code == 200
        trends_data = trends_res.json()
        print(f"    [OK] Sensor Trends retrieved: {len(trends_data)} daily summaries")

        # 7e. Get Dynamic Recommendations
        recs_res = client.get(f"/api/users/{user.device_id}/recommendations", headers=headers)
        assert recs_res.status_code == 200
        recs_data = recs_res.json()
        print(f"    [OK] Dynamic Recommendations generated ({len(recs_data)} items):")
        for rec in recs_data:
            print(f"        * [{rec.get('type')}] {rec.get('title')}: {rec.get('message')}")

        print("\n=========================================================")
        print("ALL SENSOR AND GOOGLE FIT TESTS COMPLETED SUCCESSFULLY!")
        print("User namith@gmail.com verified end-to-end.")
        print("=========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
