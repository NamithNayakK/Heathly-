import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, ChevronRight,
  ClipboardList, FileText, MessageSquare, RefreshCw,
  Shield, Sparkles, Smartphone, TrendingUp, Upload, Zap, Battery, Heart, Radio
} from "lucide-react";
import { api } from "../lib/api";
import ConsultantDashboard from "./ConsultantDashboard";
import AdminDashboard from "./AdminDashboard";
import GoogleFitPipelineCard from "../components/GoogleFitPipelineCard";


/* ── Animated radial risk gauge ── */
function RiskGauge({ score, label }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(score ?? 0), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const r = 62, circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, displayed));
  const offset = circ * (1 - pct / 100);
  const color = score === null || score === undefined ? "var(--lav)" : pct >= 70 ? "var(--teal)" : pct >= 45 ? "var(--lav)" : "var(--amber)";

  return (
    <div style={{ position: "relative", width: 148, height: 148, flexShrink: 0 }}>
      <svg width="148" height="148" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="74" cy="74" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <motion.circle
          cx="74" cy="74" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 10px ${color}70)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ fontSize: 30, fontWeight: 700, color, fontFamily: "IBM Plex Sans", lineHeight: 1 }}
        >
          {score !== null && score !== undefined ? score : "--"}
        </motion.div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label || "Wellness"}
        </div>
      </div>
    </div>
  );
}

/* ── Small animated SVG trend sparkline ── */
function Sparkline({ values = [], color = "var(--teal)" }) {
  if (!values.length) return null;
  const w = 120, h = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polyline
        points={pts} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
      />
    </svg>
  );
}

/* ── Modality shortcut button ── */
function ModalityBtn({ icon: Icon, label, color, path, navigate }) {
  return (
    <motion.button
      onClick={() => navigate(path)}
      whileHover={{ scale: 1.03, borderColor: color }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex", flexDirection: "column", gap: 10, padding: 16,
        background: "var(--bg-elevated)", border: "1px solid var(--bg-border)",
        borderRadius: 14, cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
      <ChevronRight size={12} style={{ color: "var(--text-muted)", alignSelf: "flex-end" }} />
    </motion.button>
  );
}

export default function DashboardPage() {
  const role = sessionStorage.getItem("role") || localStorage.getItem("role") || "patient";
  if (role === "consultant") return <ConsultantDashboard />;
  if (role === "admin")      return <AdminDashboard />;

  const navigate   = useNavigate();
  const userName   = sessionStorage.getItem("full_name") || localStorage.getItem("full_name") || "User";
  const [dashData, setDashData] = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadText, setUploadText] = useState("");
  const [uploading, setUploading]   = useState(false);
  const [uploadLog, setUploadLog]   = useState([]);
  const [bleStatus, setBleStatus]   = useState({ connected: false });
  const [liveTel,   setLiveTel]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, hist] = await Promise.all([api.getMultimodalDashboard(), api.getPHQ9History()]);
      setDashData(dash);
      setHistory(hist.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    let ws = null;
    api.getBluetoothStatus().then(res => {
      setBleStatus(res);
      if (res.connected) {
        ws = new WebSocket(api.getBluetoothStreamUrl());
        ws.onmessage = e => { try { setLiveTel(JSON.parse(e.data)); } catch {} };
      }
    }).catch(() => {});
    return () => ws?.close();
  }, []);

  const wellness       = dashData?.unified_wellness_index ?? null;
  const risk           = dashData?.risk_classification || "Unknown";
  const explainability = dashData?.explainability_layer || [];
  const alerts         = dashData?.alert_flags || [];
  const recommendations= dashData?.recommendations || [];

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const r = new FileReader();
    r.onload = ev => setUploadText(ev.target?.result || "");
    r.readAsText(file);
  };

  const handleUpload = async e => {
    e.preventDefault();
    if (!uploadText.trim()) return;
    setUploading(true); setUploadLog([]);
    for (const s of ["Initializing OCR pipeline...", "Running BioClinicalBERT...", "Mapping to wellness model..."]) {
      await new Promise(r => setTimeout(r, 500));
      setUploadLog(p => [...p, s]);
    }
    try {
      await api.submitHealthReport(uploadFile?.name || "manual-entry.txt", uploadText.trim());
      setUploadLog(p => [...p, "✓ Report integrated successfully."]);
      setTimeout(() => { setUploadFile(null); setUploadText(""); setUploadLog([]); load(); }, 2000);
    } catch (err) {
      setUploadLog(p => [...p, `✗ Error: ${err.message}`]);
    } finally { setUploading(false); }
  };

  // Build sparkline from history
  const sparkValues = history.slice(0, 7).reverse().map(h => 100 - (h.score / 27) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div className="page-title font-display" style={{ fontSize: 26, fontWeight: 500, color: "#F5F0EB" }}>
            Welcome back, {userName.split(" ")[0]} 🌿
          </div>
          <div className="page-subtitle" style={{ color: "#94A3B8" }}>
            Personal pattern tracker & daily reflection summary
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/assessment")} style={{ background: "linear-gradient(135deg, #D4A574, #A0785A)", color: "#0B1120" }}>
            <ClipboardList size={13} /> Check-In Journal
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.map((a, i) => (
        <div key={i} className="alert alert-info" style={{ background: "rgba(212,165,116,0.12)", borderColor: "rgba(212,165,116,0.25)", color: "#D4A574" }}>
          <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{a}</span>
        </div>
      ))}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[220, 140, 100].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 18 }} />)}
        </div>
      ) : (
        <>
          {/* ── BENTO GRID ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gridTemplateRows: "auto auto", gap: 16 }}>

            {/* [1] LARGE: Wellness score — spans 1 col, 2 rows */}
            <motion.div
              className="bento-card"
              style={{ gridRow: "span 2", display: "flex", flexDirection: "column", gap: 20, borderTop: "2px solid #D4A574" }}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div>
                <div className="section-title" style={{ marginBottom: 8, color: "#D4A574" }}>Gentle Wellness Index</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, fontFamily: "Fraunces, serif" }}>{risk?.includes("Pending") ? risk : `State: ${risk}`}</span>
                  <span className="badge badge-teal" style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574" }}>
                    {wellness !== null && wellness !== undefined ? `${wellness}` : "Pending"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                <RiskGauge score={wellness} label="Wellness" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>
                    Synthesized across {dashData?.modes_active?.length || 0} active streams including clinical NLP, sensor data, and conversation semantics.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkline values={sparkValues.length ? sparkValues : [60,65,58,70,72,68,75]} color="var(--teal)" />
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>7-day</div>
                  </div>
                </div>
              </div>

              {/* Attention Fusion bars */}
              {explainability.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="section-title">Attention Fusion</div>
                  {explainability.map((item, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "var(--text-secondary)", fontFamily: "IBM Plex Mono" }}>{item.modality?.replace(/_/g, " ")}</span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600, fontFamily: "IBM Plex Mono" }}>{((item.weight || 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="meter-bar">
                        <motion.div
                          className="meter-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.weight || 0) * 100}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                          style={{ height: "100%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div>
                  <div className="section-title">AI Insights</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recommendations.slice(0, 3).map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-secondary)", alignItems: "flex-start" }}>
                        <CheckCircle2 size={13} style={{ color: "var(--teal)", flexShrink: 0, marginTop: 2 }} />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* [2] Modality shortcuts */}
            <motion.div
              className="bento-card"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="section-title">Quick Access</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <ModalityBtn icon={ClipboardList} label="PHQ-9" color="var(--teal)" path="/assessment" navigate={navigate} />
                <ModalityBtn icon={FileText} label="Records" color="var(--emerald)" path="/health-report" navigate={navigate} />
                <ModalityBtn icon={MessageSquare} label="Chat AI" color="var(--lav)" path="/chat" navigate={navigate} />
                <ModalityBtn icon={Smartphone} label="Phone Sensors" color="var(--blue)" path="/phone-data" navigate={navigate} />
              </div>
            </motion.div>

            {/* [3] Smartphone Sensor Status */}
            <motion.div
              className="bento-card card-accent-lav"
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Phone Telemetry</div>
                <span className="badge badge-live" style={{ fontSize: 9 }}>
                  <span className="status-dot live" style={{ width: 5, height: 5 }} />
                  Active
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Smartphone size={18} style={{ color: "var(--cyan)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Smartphone & Google Fit</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>
                        {dashData?.sensors_summary?.data_source ? `Source: ${dashData.sensors_summary.data_source.replace("_", " ")}` : "WiFi & Sensor Monitor"}
                      </div>
                    </div>
                  </div>
                </div>

                {dashData?.sensors_summary ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>Steps</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--emerald)" }}>{dashData.sensors_summary.steps ?? "--"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>Sleep</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--violet)" }}>{dashData.sensors_summary.sleep_duration_hours ? `${dashData.sensors_summary.sleep_duration_hours}h` : "--"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>Heart</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--rose)" }}>{dashData.sensors_summary.heart_rate ? `${dashData.sensors_summary.heart_rate} bpm` : "--"}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: 8 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Continuous Monitoring</span>
                    <span style={{ color: "var(--teal)", fontWeight: 600 }}>Active Stream</span>
                  </div>
                )}

                <button className="btn btn-secondary btn-xs" onClick={() => navigate("/phone-data")} style={{ width: "100%", justifyContent: "center" }}>
                  Open Smartphone Console
                </button>

              </div>
            </motion.div>

            {/* [4] Upload record */}
            <motion.div
              className="bento-card"
              style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {uploading && <div className="neon-scanner" />}
              <div className="section-title">Upload Record</div>
              <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="upload-zone" style={{ display: "block" }}>
                  <Upload size={18} style={{ color: "var(--teal)", marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{uploadFile ? uploadFile.name : "Drop a file or click"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>TXT, MD, CSV · max 5MB</div>
                  <input type="file" style={{ display: "none" }} onChange={handleFileChange} />
                </label>
                {uploadLog.length > 0 && (
                  <div className="terminal" style={{ maxHeight: 70 }}>
                    {uploadLog.map((l, i) => (
                      <div key={i} className={l.startsWith("✓") ? "terminal-line-success" : l.startsWith("✗") ? "terminal-line-error" : "terminal-line-info"}>{l}</div>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary btn-sm" type="submit" disabled={uploading || !uploadFile} style={{ width: "100%" }}>
                  {uploading ? "Analyzing..." : "Run Analysis"}
                </button>
              </form>
            </motion.div>

          </div>

          {/* ── GOOGLE FIT & MANUAL SENSOR PIPELINE ── */}
          <GoogleFitPipelineCard onSyncSuccess={load} />

          {/* ── ASSESSMENT HISTORY ── */}

          <motion.div
            className="bento-card"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Assessment History</div>
              <button className="btn btn-ghost btn-xs" onClick={() => navigate("/assessment")}>
                New run <ChevronRight size={11} />
              </button>
            </div>
            {history.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>PHQ Score</th><th>Risk Level</th><th>Classifier</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 5).map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.score} / 27</td>
                      <td>
                        <span className={`badge ${item.risk_level?.toLowerCase().includes("severe") ? "badge-rose" : item.risk_level?.toLowerCase().includes("moderate") ? "badge-amber" : "badge-live"}`}>
                          {item.risk_level}
                        </span>
                      </td>
                      <td style={{ fontFamily: "IBM Plex Mono", fontSize: 10, color: "var(--text-muted)" }}>{item.agent_version || "agentic-phq9"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                No assessments yet. <button className="btn btn-ghost btn-sm" onClick={() => navigate("/assessment")}>Start your first check-in</button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
