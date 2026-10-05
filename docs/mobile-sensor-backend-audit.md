# Mobile Sensor Backend Audit

**Date:** 2026-09-19  
**Purpose:** Pre-implementation audit for Phase 2 — connecting Healthly Companion Android APK to existing backend/dashboard

---

## 1. Current Sensor Schema

### Active table: `sensor_readings` (`SensorReading` in `app/models/wifi_sensor.py`)

Wide flat row — one row aggregates all metrics per timestamp.

**Present fields:** `id`, `user_id`, `timestamp`, `data_source`, `steps`, `distance_meters`, `calories`, `active_minutes`, `is_screen_on`, `screen_time_minutes`, `screen_brightness`, `unlock_count`, `heart_rate`, `resting_heart_rate`, `hrv`, `galvanic_skin_response`, `stress_index`, `sleep_hours`, `sleep_quality`, `bedtime`, `wake_time`, `battery_level`, `is_charging`, `battery_temperature`, `current_app`, `social_app_minutes`, `productivity_app_minutes`, `entertainment_app_minutes`, `connection_type`, `wifi_ssid`, `notification_count`, `social_notifications_count`, `unique_locations`, `is_at_home`, `raw_json`, `created_at`

**Missing for mobile integration:** `device_id`, `source_record_id`, `source_record_hash`, `is_estimated`, `updated_at`, `start_time`, `end_time`

**Missing tables:** GPS sessions, Activity sessions, Accelerometer/Gyroscope features

### Deprecated table: `sensor_data` (`SensorData` in `app/models/sensor_data.py`)
Marked deprecated in code. Fields: `hrv`, `galvanic_skin_response`, `sleep_duration_hours`, `stress_index`. Not used for new writes.

### Supporting tables: `daily_aggregates`, `risk_history`

---

## 2. Current API

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/sensor-data` | API key (optional) | WiFi telemetry, anonymous device, NOT JWT |
| `GET /api/users/{id}/latest` | None | Latest reading by device_id or user_id |
| `GET /api/users/{id}/history` | None | Historical readings |
| `GET /api/users/{id}/trends` | None | Daily aggregate trends |
| `GET /api/users/{id}/risk` | None | Latest risk assessment |
| `GET /api/users/{id}/recommendations` | None | Risk-based recommendations |
| `POST /api/v1/auth/google-fit/connect` | None | Google Fit OAuth |
| `POST /api/v1/auth/google-fit/callback` | None | Google Fit callback |
| `GET /api/v1/auth/google-fit/status` | None | Google Fit connection status |
| `POST /api/v1/auth/google-fit/pull-now` | None | Manual Google Fit pull |
| `POST /api/v1/auth/google-fit/manual` | None | Manual sensor entry |
| `GET /api/v1/admin/patients/{id}/sensor-data` | Consultant/Admin JWT | Patient sensor view |

**Missing:** `/api/v1/mobile-health/*` — must be created.

---

## 3. Current Dashboard Data Flow

```
PhoneDataPage.jsx
  → api.getWifiLatest(deviceId)     → GET /api/users/{id}/latest
  → api.getWifiHistory(deviceId)    → GET /api/users/{id}/history
  → api.getWifiTrends(deviceId)     → GET /api/users/{id}/trends
  → api.getGoogleFitStatus(userId)  → GET /api/v1/auth/google-fit/status
  → api.pullGoogleFitData(userId)   → POST /api/v1/auth/google-fit/pull-now
```

Device ID is selected from a UI dropdown — not derived from authenticated user.

---

## 4. Current AI Data Flow

```
POST /api/sensor-data (wifi telemetry)
  → calculate_mental_health_risk(steps, screen, sleep, hr, hrv, social, notifications, phq9)
  → RiskHistory stored
  → wearable_lstm_analyzer.analyze(hr, hrv, sleep, steps) [used in multimodal endpoint]
  → AttentionFusionEngine [multimodal fusion]
```

---

## 5. Google Fit Dependencies

| Location | Dependency | Action |
|---|---|---|
| `main.py` | `google_fit_background_sync_loop()` background task | **Remove** (active collection) |
| `main.py` | `asyncio.create_task(google_fit_background_sync_loop())` | **Remove** |
| `app/api/v1/endpoints/google_fit.py` | OAuth/pull endpoints | **Preserve** (historical records) |
| `app/api/v1/router.py` | `google_fit` router import | **Preserve** |
| `app/services/google_fit_service.py` | Sync service | **Preserve** (not called actively) |
| `frontend/src/components/GoogleFitPipelineCard.jsx` | Google Fit UI card | **Remove from PhoneDataPage** |
| `frontend/src/lib/api.js` | `getGoogleFitStatus`, `pullGoogleFitData` | **Preserve** (historical view) |
| `workflow_4_google_fit_sync.json` | n8n workflow | Already `"active": false` — no change |
| `User.google_fit_refresh_token` | DB column | **Preserve** (historical) |

---

## 6. What Can Be Reused

- `SensorReading` model (extend with additive columns)
- `calculate_mental_health_risk()` — feed with mobile data directly
- `wearable_lstm_analyzer` — same inputs
- `get_current_user` dependency (JWT auth)
- `PatientAssignment` model (doctor-patient auth)
- `SVGLineChart` component in `PhoneDataPage.jsx`
- Daily aggregation background loop
- Risk history storage

---

## 7. What Must Be Extended

- `SensorReading`: +7 columns
- New table: `mobile_gps_sessions`
- New table: `mobile_activity_sessions`  
- New table: `mobile_sensor_features`
- New router: `/api/v1/mobile-health/*`
- New endpoint file: `mobile_health.py`
- `PhoneDataPage.jsx`: swap data source to native mobile API
- `PatientSensorViewPage.jsx`: fix deprecated field references

---

## 8. AI Model Disclosure

The `SensorBiLSTM` model (`wearable_lstm.py`) uses:
- Trained weights from `ml/artifacts/sensor_bilstm.pt` (if present)
- Statistical fallback (z-score heuristics) when model file is absent

**Status: Prototype / Experimental — not clinically validated.**  
Dashboard must display this disclaimer clearly. No clinical diagnosis should be inferred from sensor telemetry alone.
