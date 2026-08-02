import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertCircle, CheckCircle2, Heart, RefreshCw, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { api } from "../lib/api";

export default function GoogleFitPipelineCard({ onSyncSuccess }) {
  const [fitStatus, setFitStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState("");
  
  // Manual Entry Form State
  const [steps, setSteps] = useState(5000);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [heartRate, setHeartRate] = useState(72);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.getGoogleFitStatus();
      setFitStatus(res);
    } catch (e) {
      console.error("Error fetching Google Fit status:", e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Check query params for OAuth return
    const params = new URLSearchParams(window.location.search);
    const googleFitResult = params.get("google_fit");
    const msg = params.get("message");

    if (googleFitResult === "success") {
      setPullMessage("✓ Connected to Google Fit successfully!");
    } else if (googleFitResult === "cancelled") {
      setPullMessage("⚠ Connection cancelled by user.");
    } else if (googleFitResult === "error") {
      setPullMessage(`✗ Connection failed: ${msg || "Please try again."}`);
    }
  }, []);

  const handleConnect = () => {
    const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8000"
      : "";
    window.location.href = `${apiBase}/api/auth/google-fit/connect`;
  };

  const handlePullNow = async () => {
    setPulling(true);
    setPullMessage("");
    try {
      const res = await api.pullGoogleFitData();
      if (res.status === "success") {
        setPullMessage(`✓ Synced successfully! Steps: ${res.data.steps}, Sleep: ${res.data.sleep_hours}h`);
        if (onSyncSuccess) onSyncSuccess();
      } else if (res.status === "no_data_available") {
        setPullMessage("ℹ Connected, but no recent Google Fit activity data found for today.");
      } else if (res.status === "expired_token") {
        setPullMessage("⚠ Authorization expired. Please reconnect Google Fit.");
      } else {
        setPullMessage(`✗ ${res.message || "Sync failed"}`);
      }
      await fetchStatus();
    } catch (e) {
      setPullMessage(`✗ Sync error: ${e.message}`);
    } finally {
      setPulling(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setSubmittingManual(true);
    setManualMessage(null);
    try {
      const payload = {
        steps: parseInt(steps) || 0,
        sleep_hours: parseFloat(sleepHours) || 0.0,
        heart_rate: heartRate ? parseInt(heartRate) : null
      };
      const res = await api.submitManualSensorData(payload);
      if (res.status === "success") {
        setManualMessage({ type: "success", text: "✓ Telemetry saved to sensor_readings (data_source: manual)" });
        if (onSyncSuccess) onSyncSuccess();
        setTimeout(() => setManualMessage(null), 4000);
      } else {
        setManualMessage({ type: "error", text: res.message || "Save failed" });
      }
    } catch (err) {
      setManualMessage({ type: "error", text: err.message });
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      
      {/* ── GOOGLE FIT STATUS CARD ── */}
      <motion.div
        className="bento-card"
        style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "2px solid #38BDF8" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} style={{ color: "#38BDF8" }} />
            <div className="section-title" style={{ marginBottom: 0, color: "#38BDF8" }}>Google Fit Telemetry</div>
          </div>
          {loadingStatus ? (
            <span className="badge badge-secondary">Checking...</span>
          ) : fitStatus?.state_code === "connected" ? (
            <span className="badge badge-teal" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38BDF8" }}>
              <span className="status-dot live" style={{ width: 5, height: 5, background: "#38BDF8" }} />
              Connected
            </span>
          ) : fitStatus?.state_code === "expired" ? (
            <span className="badge badge-rose">Expired</span>
          ) : fitStatus?.state_code === "connected_no_data" ? (
            <span className="badge badge-amber">No Recent Data</span>
          ) : (
            <span className="badge badge-secondary">Not Connected</span>
          )}
        </div>

        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Automated background data pipeline syncing steps, sleep duration, and heart rate telemetry.
        </div>

        {/* Status display text */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--bg-border)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justify: "space-between"
        }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            {loadingStatus ? "Querying status..." : (fitStatus?.status_display || "Not connected")}
          </span>
          {fitStatus?.connected && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={handlePullNow}
              disabled={pulling}
              style={{ color: "#38BDF8" }}
            >
              <RefreshCw size={12} style={pulling ? { animation: "spin 1s linear infinite" } : {}} />
              Sync Now
            </button>
          )}
        </div>

        {pullMessage && (
          <div style={{
            fontSize: 11,
            padding: "8px 10px",
            borderRadius: 8,
            background: pullMessage.startsWith("✓") ? "rgba(52, 211, 153, 0.1)" : pullMessage.startsWith("⚠") ? "rgba(251, 191, 36, 0.1)" : "rgba(248, 113, 113, 0.1)",
            color: pullMessage.startsWith("✓") ? "#34D399" : pullMessage.startsWith("⚠") ? "#FBBF24" : "#F87171",
            fontFamily: "IBM Plex Mono"
          }}>
            {pullMessage}
          </div>
        )}

        {/* Action Button */}
        <div style={{ marginTop: "auto" }}>
          {!fitStatus?.connected || fitStatus?.state_code === "expired" ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleConnect}
              style={{ width: "100%", background: "linear-gradient(135deg, #0284C7, #0369A1)", color: "#FFFFFF" }}
            >
              <Zap size={14} /> Connect Google Fit
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePullNow}
              disabled={pulling}
              style={{ width: "100%" }}
            >
              <RefreshCw size={13} style={pulling ? { animation: "spin 1s linear infinite" } : {}} />
              {pulling ? "Syncing API..." : "Trigger Manual API Sync"}
            </button>
          )}
        </div>
      </motion.div>

      {/* ── MANUAL ENTRY FALLBACK CARD ── */}
      <motion.div
        className="bento-card"
        style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "2px solid #34D399" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Smartphone size={18} style={{ color: "#34D399" }} />
            <div className="section-title" style={{ marginBottom: 0, color: "#34D399" }}>Manual Entry Fallback</div>
          </div>
          <span className="badge badge-teal" style={{ background: "rgba(52, 211, 153, 0.15)", color: "#34D399" }}>
            Guaranteed Available
          </span>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Direct telemetry submission to guarantee continuity regardless of external Google Fit API availability.
        </div>

        <form onSubmit={handleManualSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            
            {/* Steps Input */}
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Steps Today</label>
              <input
                type="number"
                min="0"
                max="50000"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 6,
                  color: "#F5F0EB",
                  fontSize: 12,
                  fontFamily: "IBM Plex Mono"
                }}
              />
            </div>

            {/* Sleep Input */}
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Sleep (hrs)</label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 6,
                  color: "#F5F0EB",
                  fontSize: 12,
                  fontFamily: "IBM Plex Mono"
                }}
              />
            </div>

            {/* Heart Rate Input */}
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>HR (bpm)</label>
              <input
                type="number"
                min="30"
                max="220"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                placeholder="72"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 6,
                  color: "#F5F0EB",
                  fontSize: 12,
                  fontFamily: "IBM Plex Mono"
                }}
              />
            </div>

          </div>

          {manualMessage && (
            <div style={{
              fontSize: 11,
              padding: "6px 8px",
              borderRadius: 6,
              background: manualMessage.type === "success" ? "rgba(52, 211, 153, 0.1)" : "rgba(248, 113, 113, 0.1)",
              color: manualMessage.type === "success" ? "#34D399" : "#F87171",
              fontFamily: "IBM Plex Mono"
            }}>
              {manualMessage.text}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={submittingManual}
            style={{ width: "100%", marginTop: 4, background: "rgba(52, 211, 153, 0.12)", color: "#34D399", borderColor: "rgba(52, 211, 153, 0.25)" }}
          >
            {submittingManual ? "Saving..." : "Save Manual Telemetry"}
          </button>
        </form>
      </motion.div>

    </div>
  );
}
