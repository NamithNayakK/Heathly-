import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Heart, Moon, Smartphone, RefreshCw, Wifi, WifiOff,
  Footprints, Flame, Clock, MapPin, Navigation, Radio, Cpu,
  TrendingUp, Shield, AlertTriangle, CheckCircle, Info,
  ChevronUp, ChevronDown
} from "lucide-react";
import { api } from "../lib/api";

// ─── SVG LINE CHART (reused from original) ───────────────────────────────────
function SVGLineChart({ data, dataKey, color, label, unit = "" }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: "flex", height: 120, alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12, border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 8, flexDirection: "column", gap: 6 }}>
        <Info style={{ width: 16, height: 16, opacity: 0.5 }} />
        <span>No historical data available</span>
      </div>
    );
  }

  const values = data.map(d => Number(d[dataKey]) || 0);
  // Only plot points where data actually exists (not null/0 from missing days)
  const hasData = values.some(v => v > 0);
  if (!hasData) {
    return (
      <div style={{ display: "flex", height: 120, alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12, border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 8, flexDirection: "column", gap: 6 }}>
        <span>Not available</span>
      </div>
    );
  }

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values.filter(v => v > 0), 0);
  const valRange = maxVal - minVal || 1;
  const width = 500;
  const height = 120;
  const padding = 15;

  // Only include points with actual data (sparse-safe — no interpolation across gaps)
  const validPoints = data
    .map((d, i) => ({ d, i, val: Number(d[dataKey]) || 0 }))
    .filter(p => p.val > 0);

  return (
    <div style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid rgba(255,255,255,0.05)", padding: 12, borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
        <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>Peak: {maxVal.toLocaleString()} {unit}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" />
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {validPoints.length > 1 ? (
          <>
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={validPoints.map(p => {
                const x = padding + (p.i / (data.length - 1)) * (width - padding * 2);
                const y = height - padding - ((p.val - minVal) / valRange) * (height - padding * 2);
                return `${x},${y}`;
              }).join(" ")}
            />
          </>
        ) : validPoints.length === 1 ? (
          <circle
            cx={padding + (validPoints[0].i / Math.max(data.length - 1, 1)) * (width - padding * 2)}
            cy={height / 2}
            r={5}
            fill={color}
          />
        ) : null}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: "var(--text-muted)" }}>
        <span>{data[0]?.date || ""}</span>
        <span>{data[data.length - 1]?.date || ""}</span>
      </div>
    </div>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, unit, source, available, unavailableReason, isEstimated, color = "var(--teal)" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--bg-border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon style={{ width: 14, height: 14, color }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        </div>
        {isEstimated && (
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(251,191,36,0.12)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.2)", fontFamily: "IBM Plex Mono" }}>
            ESTIMATED
          </span>
        )}
      </div>
      {available ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", fontFamily: "IBM Plex Sans" }}>
            {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{unit}</span>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
          {unavailableReason || "Not available"}
        </span>
      )}
      {source && available && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>
          Source: {SOURCE_LABELS[source] || source}
        </span>
      )}
    </motion.div>
  );
}

const SOURCE_LABELS = {
  health_connect: "Health Connect",
  android_sensor: "Android Sensor",
  activity_recognition: "Activity Recognition",
  gps: "GPS",
  usage_stats: "Usage Statistics",
  manual: "Manual Entry",
  google_fit: "Historical: Google Fit",
  wifi: "WiFi Sensor (Legacy)",
  unknown: "Unknown",
};

const ACTIVITY_ICONS = {
  walking: "🚶",
  running: "🏃",
  cycling: "🚴",
  vehicle: "🚗",
  still: "🧘",
  unknown: "❓",
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PhoneDataPage() {
  const [todayData, setTodayData] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [trendRange, setTrendRange] = useState("7d");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showTrendSection, setShowTrendSection] = useState(true);

  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [todayRes, statusRes, activityRes, trendsRes] = await Promise.allSettled([
        api.getMobileHealthToday(),
        api.getMobileHealthStatus(),
        api.getMobileHealthActivity(1),
        api.getMobileHealthTrends(trendRange),
      ]);

      if (todayRes.status === "fulfilled") setTodayData(todayRes.value);
      if (statusRes.status === "fulfilled") setSyncStatus(statusRes.value);
      if (activityRes.status === "fulfilled") setActivityData(activityRes.value);
      if (trendsRes.status === "fulfilled") setTrendsData(trendsRes.value);

      if (todayRes.status === "rejected") {
        const msg = todayRes.reason?.message || "";
        if (msg.includes("401") || msg.toLowerCase().includes("authentication")) {
          setError("Please log in to view your sensor data.");
        } else {
          setError("Unable to load sensor data. Please ensure the backend is running.");
        }
      }
    } catch (err) {
      setError("Failed to load mobile health data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trendRange]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleTrendRangeChange = (range) => {
    setTrendRange(range);
  };

  useEffect(() => {
    if (!loading) {
      api.getMobileHealthTrends(trendRange)
        .then(d => setTrendsData(d))
        .catch(() => {});
    }
  }, [trendRange]);

  const metrics = todayData?.metrics || {};
  const trends = trendsData?.trends || [];

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: 16 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw style={{ width: 28, height: 28, color: "var(--teal)" }} />
        </motion.div>
        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading sensor data...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 0 48px" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            Smartphone Sensor Data
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
            <Smartphone style={{ width: 12, height: 12 }} />
            Healthly Companion · Native Android Collection
          </p>
        </div>
        <button
          onClick={() => loadAllData(true)}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            borderRadius: "var(--radius-md)", border: "1px solid var(--bg-border)",
            background: "var(--bg-elevated)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13,
          }}
        >
          <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
            <RefreshCw style={{ width: 14, height: 14 }} />
          </motion.div>
          Refresh
        </button>
      </div>

      {/* ── DISCLAIMER ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", marginBottom: 24 }}>
        <AlertTriangle style={{ width: 14, height: 14, color: "#FBBF24", flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          <strong style={{ color: "#FBBF24" }}>Prototype / Experimental</strong> — Sensor-based risk indicators are not clinically validated and should not replace professional medical assessment.
        </span>
      </div>

      {/* ── ERROR STATE ────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171", fontSize: 13, marginBottom: 24, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ── SYNC STATUS ─────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: syncStatus?.last_sync ? "#34D399" : "#6B7280" }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              {syncStatus?.last_sync ? "Synced" : "Never synced"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {syncStatus?.last_sync_relative || "Install the Healthly Companion app to sync data"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {syncStatus?.sources && Object.entries(syncStatus.sources).map(([src, active]) => (
            <span key={src} style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4, fontFamily: "IBM Plex Mono",
              background: active ? "rgba(52,211,153,0.1)" : "rgba(107,114,128,0.1)",
              color: active ? "#34D399" : "var(--text-muted)",
              border: `1px solid ${active ? "rgba(52,211,153,0.25)" : "rgba(107,114,128,0.2)"}`,
            }}>
              {SOURCE_LABELS[src] || src}
            </span>
          ))}
        </div>
        {syncStatus?.device_id && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>
            Device: {syncStatus.device_id.slice(0, 16)}…
          </div>
        )}
      </div>

      {/* ── TODAY'S METRICS ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
          Today's Sensor Data
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          <MetricCard
            icon={Footprints} label="Steps"
            value={metrics.steps?.value} unit="steps"
            source={metrics.steps?.source}
            available={metrics.steps?.available}
            unavailableReason="No step data from Health Connect"
            color="var(--teal)"
          />
          <MetricCard
            icon={Navigation} label="Distance"
            value={metrics.distance?.value} unit="km"
            source={metrics.distance?.source}
            available={metrics.distance?.available}
            unavailableReason="No distance data available"
            color="var(--blue)"
          />
          <MetricCard
            icon={Flame} label="Calories"
            value={metrics.calories?.value} unit="kcal"
            source={metrics.calories?.source}
            available={metrics.calories?.available}
            unavailableReason="No calorie data available"
            isEstimated={metrics.calories?.is_estimated}
            color="#F97316"
          />
          <MetricCard
            icon={Heart} label="Heart Rate"
            value={metrics.heart_rate?.value} unit="BPM"
            source={metrics.heart_rate?.source}
            available={metrics.heart_rate?.available}
            unavailableReason={metrics.heart_rate?.unavailable_reason || "Not available on this device/source"}
            color="#F87171"
          />
          <MetricCard
            icon={Moon} label="Sleep"
            value={metrics.sleep?.value} unit="hours"
            source={metrics.sleep?.source}
            available={metrics.sleep?.available}
            unavailableReason={metrics.sleep?.unavailable_reason || "No Health Connect sleep source available"}
            color="var(--lav)"
          />
          <MetricCard
            icon={Activity} label="Active Minutes"
            value={metrics.active_minutes?.value} unit="min"
            source={metrics.active_minutes?.source}
            available={metrics.active_minutes?.available}
            unavailableReason="No activity data available"
            color="var(--emerald)"
          />
          <MetricCard
            icon={Smartphone} label="Screen Time"
            value={metrics.screen_time?.value} unit="min"
            source={metrics.screen_time?.source}
            available={metrics.screen_time?.available}
            unavailableReason={metrics.screen_time?.unavailable_reason || "Usage Access not enabled"}
            color="#A78BFA"
          />
        </div>
      </div>

      {/* ── CURRENT ACTIVITY ─────────────────────────────────────────────────── */}
      {todayData?.current_activity && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Current Activity</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{ACTIVITY_ICONS[todayData.current_activity.type] || "❓"}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>
                {todayData.current_activity.type}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Duration: {Math.round(todayData.current_activity.duration_seconds / 60)} min
                {" · "}Confidence: {todayData.current_activity.confidence}%
                {" · "}Source: Activity Recognition
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GPS SESSIONS ─────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>GPS Journeys</h2>
        {activityData?.gps_sessions?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activityData.gps_sessions.map(g => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--bg-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <MapPin style={{ width: 16, height: 16, color: "var(--teal)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {g.distance_km} km
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(g.start_time).toLocaleTimeString()} → {new Date(g.end_time).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.duration_minutes} min</div>
                  {g.average_speed_kmh && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.average_speed_kmh} km/h avg</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <MapPin style={{ width: 20, height: 20, opacity: 0.3 }} />
            <span>No GPS journeys today</span>
            <span style={{ fontSize: 11 }}>Location permission required</span>
          </div>
        )}
      </div>

      {/* ── ACTIVITY SESSIONS ─────────────────────────────────────────────────── */}
      {activityData?.activity_sessions?.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Activity Sessions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activityData.activity_sessions.slice(0, 8).map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{ACTIVITY_ICONS[a.activity_type] || "❓"}</span>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{a.activity_type}</span>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.duration_minutes} min</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>{a.confidence}% confidence</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SENSOR STATUS ─────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Sensor Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {[
            { key: "health_connect", label: "Health Connect", icon: Heart },
            { key: "android_sensor", label: "Accelerometer / Gyro", icon: Cpu },
            { key: "activity_recognition", label: "Activity Recognition", icon: Activity },
            { key: "gps", label: "GPS Tracking", icon: MapPin },
            { key: "usage_stats", label: "Screen Time", icon: Smartphone },
          ].map(({ key, label, icon: Icon }) => {
            const active = syncStatus?.sources?.[key];
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--bg-border)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#34D399" : "#6B7280", flexShrink: 0 }} />
                <Icon style={{ width: 14, height: 14, color: active ? "var(--teal)" : "var(--text-muted)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{active ? "Active" : "Inactive / No data"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TREND CHARTS ──────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "var(--radius-lg)", padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Trends
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {["7d", "30d"].map(r => (
              <button
                key={r}
                onClick={() => handleTrendRangeChange(r)}
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: "1px solid", cursor: "pointer",
                  background: trendRange === r ? "var(--teal)" : "transparent",
                  color: trendRange === r ? "#fff" : "var(--text-muted)",
                  borderColor: trendRange === r ? "var(--teal)" : "var(--bg-border)",
                }}
              >
                {r === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
            <button onClick={() => setShowTrendSection(p => !p)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              {showTrendSection ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showTrendSection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}
            >
              <SVGLineChart data={trends} dataKey="steps" color="var(--teal)" label="Steps" unit="steps" />
              <SVGLineChart data={trends} dataKey="distance_km" color="var(--blue)" label="Distance" unit="km" />
              <SVGLineChart data={trends} dataKey="calories" color="#F97316" label="Calories" unit="kcal" />
              <SVGLineChart data={trends} dataKey="heart_rate_avg" color="#F87171" label="Heart Rate" unit="BPM" />
              <SVGLineChart data={trends} dataKey="sleep_hours" color="var(--lav)" label="Sleep" unit="h" />
              <SVGLineChart data={trends} dataKey="screen_time_minutes" color="#A78BFA" label="Screen Time" unit="min" />
              <SVGLineChart data={trends} dataKey="active_minutes" color="var(--emerald)" label="Active Minutes" unit="min" />
            </motion.div>
          )}
        </AnimatePresence>
        {trends.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
            No trend data available yet. Sync the Healthly Companion app to build history.
          </div>
        )}
      </div>
    </div>
  );
}