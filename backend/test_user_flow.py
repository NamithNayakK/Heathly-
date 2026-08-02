import requests

BASE_URL = "http://localhost:8000"

def test_namith_user_flow():
    # 1. Login with namithnayakk@gmail.com / 12345678
    login_data = {
        "username": "namithnayakk@gmail.com",
        "password": "12345678"
    }
    print("[1] Logging in as namithnayakk@gmail.com...")
    res = requests.post(f"{BASE_URL}/api/v1/auth/login/access-token", data=login_data)
    if res.status_code != 200:
        print(f"Login failed (HTTP {res.status_code}): {res.text}")
        # Try register if account doesn't exist yet
        reg_data = {
            "email": "namithnayakk@gmail.com",
            "password": "12345678",
            "full_name": "Namith Nayak",
            "role": "patient"
        }
        reg_res = requests.post(f"{BASE_URL}/api/v1/auth/register", json=reg_data)
        print(f"Register result (HTTP {reg_res.status_code}): {reg_res.text}")
        res = requests.post(f"{BASE_URL}/api/v1/auth/login/access-token", data=login_data)

    token_info = res.json()
    token = token_info.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[SUCCESS] Logged in successfully! Token: {token[:20]}...")

    # 2. Check Google Fit Status
    status_res = requests.get(f"{BASE_URL}/api/auth/google-fit/status", headers=headers)
    print(f"[2] Google Fit Status: HTTP {status_res.status_code} -> {status_res.json()}")

    # 3. Submit Manual Telemetry Fallback
    manual_payload = {
        "steps": 7850,
        "sleep_hours": 7.5,
        "heart_rate": 72
    }
    print(f"[3] Submitting manual telemetry: {manual_payload}...")
    manual_res = requests.post(f"{BASE_URL}/api/auth/google-fit/manual", json=manual_payload, headers=headers)
    print(f"Manual Entry Result: HTTP {manual_res.status_code} -> {manual_res.json()}")
    assert manual_res.status_code == 200

    # 4. Fetch Latest Sensor Reading for User
    latest_res = requests.get(f"{BASE_URL}/api/users/namithnayakk@gmail.com/latest", headers=headers)
    print(f"[4] Latest Sensor Reading: HTTP {latest_res.status_code} -> {latest_res.json()}")
    latest_data = latest_res.json()
    assert latest_data.get("steps") == 7850
    assert latest_data.get("sleep_hours") == 7.5
    assert latest_data.get("heart_rate") == 72
    assert latest_data.get("data_source") == "manual"

    print("\n[ALL TESTS PASSED] Telemetry pipeline verified end-to-end for user namithnayakk@gmail.com!")

if __name__ == "__main__":
    test_namith_user_flow()
