"""
inject_test_sensor_data.py
Simulates the Healthly Companion Android APK sending a realistic batch sync
to POST /api/v1/mobile-health/sync.

This lets us test the sensor dashboard end-to-end without a physical Android device.
Run: python inject_test_sensor_data.py
"""
import json
import sys
import uuid
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:8000"
API = f"{BASE_URL}/api/v1/mobile-health"
AUTH = f"{BASE_URL}/api/v1/auth"

DEVICE_ID = "test-android-companion-v1"


def login(email: str, password: str) -> str:
    resp = requests.post(f"{AUTH}/login", json={"email": email, "password": password}, timeout=10)
    if resp.status_code != 200:
        print(f"Login failed ({resp.status_code}): {resp.text}")
        sys.exit(1)
    token = resp.json()["access_token"]
    print(f"  ✓ Logged in as {email}")
    return token


def sync_data(token: str, payload: dict):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    resp = requests.post(f"{API}/sync", json=payload, headers=headers, timeout=15)
    if resp.status_code == 200:
        d = resp.json()
        print(f"  ✓ Sync OK — accepted: {d['accepted']}, skipped: {d['skipped_duplicate']}, rejected: {d['rejected_invalid']}")
        if d.get("errors"):
            for e in d["errors"]:
                print(f"    ⚠ {e}")
    else:
        print(f"  ✗ Sync FAILED ({resp.status_code}): {resp.text[:300]}")
    return resp


def build_realistic_payload():
    """Build a realistic 7-day sync batch with multiple metric types, GPS journeys, and activity sessions."""
    now = datetime.now(timezone.utc)
    records = []
    activity_sessions = []
    gps_sessions = []
    screen_time_records = []
    sensor_features = []

    # ── 7 days of daily data ─────────────────────────────────────────────────
    daily_data = [
        # (steps, distance_m, calories, hr_bpm, sleep_minutes, screen_minutes, active_minutes)
        (9847,  7234.0, 412.0, 74, 430, 187, 52),
        (6521,  4811.0, 278.0, 68, 455, 210, 38),
        (11203, 8234.0, 502.0, 71, 405, 165, 67),
        (7845,  5790.0, 334.0, 72, 480, 145, 45),
        (10102, 7430.0, 448.0, 70, 420, 195, 58),
        (5234,  3870.0, 223.0, 76, 390, 235, 28),
        (8901,  6545.0, 378.0, 73, 445, 175, 49),  # today
    ]

    for i, (steps, dist, cals, hr, sleep_min, screen_min, active_min) in enumerate(daily_data):
        day = now - timedelta(days=6 - i)
        is_today = i == 6

        # Steps (Health Connect)
        records.append({
            "metric_type": "steps",
            "value": float(steps),
            "unit": "count",
            "recorded_at": day.replace(hour=22, minute=0, second=0).isoformat(),
            "start_time": day.replace(hour=0, minute=0, second=0).isoformat(),
            "end_time": day.replace(hour=22, minute=0, second=0).isoformat(),
            "data_source": "health_connect",
            "source_record_id": f"steps-day-{i}-{DEVICE_ID}",
            "is_estimated": False,
        })

        # Distance (Health Connect)
        records.append({
            "metric_type": "distance",
            "value": dist,
            "unit": "meters",
            "recorded_at": day.replace(hour=22, minute=0, second=0).isoformat(),
            "data_source": "health_connect",
            "source_record_id": f"dist-day-{i}-{DEVICE_ID}",
            "is_estimated": False,
        })

        # Calories (estimated)
        records.append({
            "metric_type": "calories",
            "value": cals,
            "unit": "kcal",
            "recorded_at": day.replace(hour=22, minute=0, second=0).isoformat(),
            "data_source": "health_connect",
            "source_record_id": f"cal-day-{i}-{DEVICE_ID}",
            "is_estimated": True,
        })

        # Heart Rate (multiple readings per day)
        for h in [9, 12, 15, 18, 21]:
            records.append({
                "metric_type": "heart_rate",
                "value": float(hr + (h - 15) // 3),
                "unit": "bpm",
                "recorded_at": day.replace(hour=h, minute=0, second=0).isoformat(),
                "data_source": "health_connect",
                "source_record_id": f"hr-day-{i}-h{h}-{DEVICE_ID}",
                "is_estimated": False,
            })

        # Sleep (Health Connect)
        sleep_start = (day - timedelta(days=1)).replace(hour=23, minute=0, second=0)
        records.append({
            "metric_type": "sleep",
            "value": float(sleep_min),
            "unit": "minutes",
            "recorded_at": day.replace(hour=7, minute=30, second=0).isoformat(),
            "start_time": sleep_start.isoformat(),
            "end_time": day.replace(hour=7, minute=30, second=0).isoformat(),
            "data_source": "health_connect",
            "source_record_id": f"sleep-day-{i}-{DEVICE_ID}",
            "is_estimated": False,
        })

        # Active Minutes (Health Connect)
        records.append({
            "metric_type": "active_minutes",
            "value": float(active_min),
            "unit": "minutes",
            "recorded_at": day.replace(hour=22, minute=0, second=0).isoformat(),
            "data_source": "health_connect",
            "source_record_id": f"active-day-{i}-{DEVICE_ID}",
            "is_estimated": False,
        })

        # Screen Time (Usage Stats)
        screen_time_records.append({
            "date": day.strftime("%Y-%m-%d"),
            "total_minutes": screen_min,
            "social_minutes": screen_min // 3,
            "productivity_minutes": screen_min // 4,
            "entertainment_minutes": screen_min // 5,
            "unlock_count": 35 + i * 3,
            "source_record_id": f"screen-day-{i}-{DEVICE_ID}",
        })

    # ── Today's GPS sessions ─────────────────────────────────────────────────
    # Morning walk
    morning_walk_start = now.replace(hour=7, minute=30, second=0, microsecond=0)
    gps_sessions.append({
        "start_time": morning_walk_start.isoformat(),
        "end_time": (morning_walk_start + timedelta(minutes=28)).isoformat(),
        "distance_meters": 2340.0,
        "duration_seconds": 1680,
        "average_speed_ms": 1.39,
        "max_speed_ms": 2.1,
        "route_point_count": 168,
        "source_record_id": f"gps-morning-{DEVICE_ID}",
    })
    # Afternoon run
    run_start = now.replace(hour=17, minute=0, second=0, microsecond=0)
    gps_sessions.append({
        "start_time": run_start.isoformat(),
        "end_time": (run_start + timedelta(minutes=22)).isoformat(),
        "distance_meters": 4200.0,
        "duration_seconds": 1320,
        "average_speed_ms": 3.18,
        "max_speed_ms": 4.5,
        "route_point_count": 264,
        "source_record_id": f"gps-run-{DEVICE_ID}",
    })

    # ── Today's Activity Sessions ────────────────────────────────────────────
    activity_sessions.append({
        "activity_type": "walking",
        "start_time": morning_walk_start.isoformat(),
        "end_time": (morning_walk_start + timedelta(minutes=28)).isoformat(),
        "duration_seconds": 1680,
        "confidence": 92,
        "steps": 2340,
        "distance_meters": 1750.0,
        "calories": 87.0,
        "source_record_id": f"act-walk-{DEVICE_ID}",
    })
    activity_sessions.append({
        "activity_type": "running",
        "start_time": run_start.isoformat(),
        "end_time": (run_start + timedelta(minutes=22)).isoformat(),
        "duration_seconds": 1320,
        "confidence": 97,
        "steps": 4100,
        "distance_meters": 4200.0,
        "calories": 198.0,
        "source_record_id": f"act-run-{DEVICE_ID}",
    })
    activity_sessions.append({
        "activity_type": "still",
        "start_time": (now - timedelta(hours=2)).isoformat(),
        "end_time": (now - timedelta(hours=1)).isoformat(),
        "duration_seconds": 3600,
        "confidence": 99,
        "source_record_id": f"act-still-{DEVICE_ID}",
    })

    # ── Accelerometer Feature Windows (on-device computed) ───────────────────
    for w in range(4):
        window_start = now.replace(hour=8, minute=0, second=0) + timedelta(minutes=w * 15)
        sensor_features.append({
            "sensor_type": "accelerometer",
            "window_start": window_start.isoformat(),
            "window_end": (window_start + timedelta(minutes=15)).isoformat(),
            "window_size_ms": 900000,
            "mean_x": 0.02 + w * 0.01,
            "mean_y": 9.78 + w * 0.02,
            "mean_z": 0.15 - w * 0.01,
            "std_x": 0.45 + w * 0.1,
            "std_y": 0.38 + w * 0.08,
            "std_z": 0.52 + w * 0.12,
            "magnitude_mean": 9.81,
            "magnitude_std": 0.67 + w * 0.15,
            "movement_intensity": 0.35 + w * 0.1,
            "source_record_id": f"accel-w{w}-{DEVICE_ID}",
        })

    return {
        "device_id": DEVICE_ID,
        "app_version": "1.0.0-simulation",
        "records": records,
        "sensor_features": sensor_features,
        "activity_sessions": activity_sessions,
        "gps_sessions": gps_sessions,
        "screen_time": screen_time_records,
    }


def verify_endpoints(token: str):
    """Check all GET endpoints return real data."""
    headers = {"Authorization": f"Bearer {token}"}
    print("\n  Verifying GET endpoints...")

    endpoints = [
        ("/today", "metrics"),
        ("/status", "sources"),
        ("/history?days=7", None),
        ("/trends?range=7d", "trends"),
        ("/activity?days=1", "gps_sessions"),
    ]

    for path, key in endpoints:
        resp = requests.get(f"{API}{path}", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if key and key in data:
                val = data[key]
                extra = f"({len(val)} items)" if isinstance(val, list) else ""
                print(f"  ✓ GET {path} — '{key}' present {extra}")
            elif not key:
                count = len(data) if isinstance(data, list) else "?"
                print(f"  ✓ GET {path} — {count} records")
            else:
                print(f"  ⚠ GET {path} — '{key}' missing. Keys: {list(data.keys())}")
        else:
            print(f"  ✗ GET {path} — {resp.status_code}")

    # Show today's summary
    resp = requests.get(f"{API}/today", headers=headers, timeout=10)
    if resp.status_code == 200:
        d = resp.json()
        m = d.get("metrics", {})
        print("\n  ── Today's Sensor Summary ──────────────────────────────────")
        for metric, info in m.items():
            if isinstance(info, dict):
                val = info.get("value")
                unit = info.get("unit", "")
                src = info.get("source", "—")
                avail = info.get("available", False)
                if avail:
                    print(f"  {'✓'} {metric:20s} {str(val):>10} {unit:<10} [{src}]")
                else:
                    print(f"  {'○'} {metric:20s} {'—':>10}            [not available]")

        # GPS
        gps = d.get("gps_summary", {})
        if gps.get("available"):
            print(f"  ✓ {'gps_sessions':20s} {gps['session_count']:>10} sessions, {gps['total_km']} km total")

        # Risk
        risk = d.get("risk", {})
        if risk:
            print(f"  ✓ {'risk_score':20s} {str(risk.get('score', '—')):>10}  [{risk.get('level', '—')}]")


def get_test_accounts():
    """Try to find test accounts by fetching user list."""
    # Try common default accounts from previous tests
    candidates = [
        ("test@healthly.com", "test123"),
        ("patient@healthly.com", "test123"),
        ("patient@example.com", "password123"),
        ("admin@healthly.com", "admin123"),
        ("namith@healthly.com", "test123"),
    ]
    for email, pwd in candidates:
        try:
            resp = requests.post(f"{AUTH}/login", json={"email": email, "password": pwd}, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                role = data.get("role", "unknown")
                if role in ("patient", None, "unknown"):
                    return email, pwd, data.get("access_token")
        except Exception:
            pass
    return None, None, None


if __name__ == "__main__":
    print("=" * 65)
    print("  Healthly Companion — Sensor Data Injection (Simulation)")
    print("  Simulates 7 days of native Android sensor data")
    print("=" * 65)

    # Check backend
    try:
        requests.get(BASE_URL, timeout=5)
    except Exception:
        print("\n✗ Backend not reachable at http://localhost:8000")
        print("  Start it with: python start.py")
        sys.exit(1)

    print("\n🔑 Finding patient account...")
    email, password, token = get_test_accounts()

    if not token:
        email = input("  Enter patient email: ").strip()
        password = input("  Enter patient password: ").strip()
        token = login(email, password)
    else:
        print(f"  ✓ Found account: {email}")

    print("\n📡 Building realistic 7-day sync payload...")
    payload = build_realistic_payload()
    record_count = len(payload["records"])
    print(f"  Records: {record_count} sensor records")
    print(f"  Activity sessions: {len(payload['activity_sessions'])}")
    print(f"  GPS sessions: {len(payload['gps_sessions'])}")
    print(f"  Sensor feature windows: {len(payload['sensor_features'])}")
    print(f"  Screen time records: {len(payload['screen_time'])}")

    print("\n📤 Syncing to backend...")
    r = sync_data(token, payload)

    if r.status_code == 200:
        print("\n✓ Data synced successfully")
        verify_endpoints(token)

        print("\n🌐 Dashboard URL:")
        print("  Patient view (sensor dashboard): http://localhost:5173/phone-data")
        print("  Consultant view:                 http://localhost:5173/patient-sensor-view")
        print("\n  Login, navigate to 'Smartphone Sensor Data', and verify the data above appears.")
    else:
        print("\n✗ Sync failed — check backend logs")
