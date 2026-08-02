import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowLeft, Brain, CheckCircle2, Cpu,
  FileText, Heart, Save, Shield, Tag, Video
} from "lucide-react";
import { api } from "../lib/api";

/* ── SVG Sparkline (reused pattern from DashboardPage) ── */
function TrendChart({ values = [], color = "var(--teal)", height = 80, label = "" }) {
  if (!values.length) return <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No data</div>;
  const w = 300, h = height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return `${x},${y}`;
  }).join(" ");
  const areaPath = `M0,${h} L${pts.split(" ").map(p => p).join(" L")} L${w},${h} Z`;

  return (
    <div>
      {label && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>}
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`tg-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#tg-${label})`} />
        <motion.polyline
          points={pts} fill="none" stroke={color}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Latest value dot */}
        {values.length > 0 && (() => {
          const lastX = w;
          const lastY = h - 4 - ((values[values.length - 1] - min) / range) * (h - 8);
          return <circle cx={lastX} cy={lastY} r="4" fill={color} />;
        })()}
      </svg>
    </div>
  );
}

/* ── Sub-dimension bar ── */
function DimensionBar({ label, value, max = 9, icon: Icon, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
          <Icon style={{ width: 12, height: 12, color }} />
          {label}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>{value}/{max}</span>
      </div>
      <div className="meter-bar">
        <motion.div
          className="meter-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: color }}
        />
      </div>
    </div>
  );
}


function getEmotionIcon(emotion) {
  const e = (emotion || '').toLowerCase();
  if (e.includes('happy') || e.includes('joy')) return { emoji: "😊", color: "var(--emerald)" };
  if (e.includes('sad')) return { emoji: "😢", color: "var(--cyan)" };
  if (e.includes('angry')) return { emoji: "😠", color: "var(--rose)" };
  if (e.includes('fear') || e.includes('anxiety')) return { emoji: "😨", color: "var(--amber)" };
  if (e.includes('surprise')) return { emoji: "😮", color: "var(--violet)" };
  if (e.includes('disgust')) return { emoji: "🤢", color: "var(--amber)" };
  return { emoji: "😐", color: "var(--teal)" };
}

function LiveSessionEmotionPanel({ patientId }) {
  const [activeSession, setActiveSession] = useState(false);
  const [latestFrame, setLatestFrame] = useState(null);
  const [arousalHistory, setArousalHistory] = useState([]);
  const [valenceHistory, setValenceHistory] = useState([]);
  const idleTimeoutRef = useRef(null);

  useEffect(() => {
    if (!patientId) return;

    const wsUrl = api.getLiveSessionUrl(patientId);
    let ws = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "connected" || data.event === "pong") return;

          setActiveSession(true);
          setLatestFrame(data);

          if (typeof data.facial_arousal === 'number') {
            setArousalHistory(prev => [...prev.slice(-19), data.facial_arousal]);
          }
          if (typeof data.facial_valence === 'number') {
            setValenceHistory(prev => [...prev.slice(-19), data.facial_valence]);
          }

          if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = setTimeout(() => {
            setActiveSession(false);
          }, 15000);
        } catch (err) {
          console.error("Error parsing WS frame:", err);
        }
      };
    } catch (e) {
      console.error("WebSocket connection error:", e);
    }

    return () => {
      if (ws) ws.close();
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [patientId]);

  const emotionInfo = getEmotionIcon(latestFrame?.dominant_expression);
  const modelStatus = latestFrame?.model_status || "validated";
  const validationAccuracy = latestFrame?.validation_accuracy || 0.1719;

  return (
    <motion.div
      className="bento-card"
      style={{
        border: activeSession ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--bg-border)",
        background: activeSession ? "rgba(16, 185, 129, 0.03)" : "var(--bg-card)",
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Live Video Session Telemetry</div>
          {activeSession ? (
            <span className="badge badge-live" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald)', boxShadow: '0 0 8px var(--emerald)' }} />
              LIVE FEED ACTIVE
            </span>
          ) : (
            <span className="badge badge-muted" style={{ fontSize: 10 }}>No Active Session</span>
          )}
        </div>

        {/* Clinical Validation Status Badge */}
        <div
          className="badge"
          style={{
            background: modelStatus === "validated" ? "rgba(20, 184, 166, 0.12)" : "rgba(245, 158, 11, 0.12)",
            border: `1px solid ${modelStatus === "validated" ? "rgba(20, 184, 166, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            color: modelStatus === "validated" ? "var(--teal)" : "var(--amber)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={13} />
          {modelStatus === "validated"
            ? `FER-2013 Model (${(validationAccuracy * 100).toFixed(1)}% Val Accuracy)`
            : "Prototype — emotion detection not yet clinically validated"}
        </div>
      </div>

      {!activeSession ? (
        <div style={{ padding: '20px 16px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px dashed var(--bg-border)' }}>
          <Video style={{ width: 24, height: 24, color: 'var(--text-muted)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>No active video session in progress</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 500, margin: '4px auto 0' }}>
            When this patient starts a video session, live facial emotion classification, arousal, and valence telemetry will stream here in real time.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 16, alignItems: 'center' }}>
          {/* Dominant Emotion Indicator */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: `1px solid ${emotionInfo.color}30` }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', marginBottom: 4 }}>
              Dominant Emotion
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>{emotionInfo.emoji}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: emotionInfo.color, textTransform: 'capitalize' }}>
                  {latestFrame.dominant_expression}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                  Conf: {((latestFrame.confidence || 0) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Facial Arousal Sparkline */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>Arousal Trend</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', fontFamily: 'IBM Plex Mono' }}>
                {latestFrame.facial_arousal?.toFixed(2) ?? '0.00'}
              </span>
            </div>
            <TrendChart values={arousalHistory.length ? arousalHistory : [0.5]} color="var(--amber)" height={45} />
          </div>

          {/* Facial Valence Sparkline */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>Valence Trend</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', fontFamily: 'IBM Plex Mono' }}>
                {latestFrame.facial_valence?.toFixed(2) ?? '0.00'}
              </span>
            </div>
            <TrendChart values={valenceHistory.length ? valenceHistory : [0.0]} color="var(--cyan)" height={45} />
          </div>
        </div>
      )}
    </motion.div>
  );
}


export default function PatientDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Review state
  const [clinicalNote, setClinicalNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!patientId) { setError("No patient ID"); setLoading(false); return; }
    const load = async () => {
      try {
        const d = await api.getPatientDetail(patientId);
        setData(d);
        // Pre-fill note from latest assessment if exists
        if (d.latest_assessment?.clinical_note) {
          setClinicalNote(d.latest_assessment.clinical_note);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  const handleMarkReviewed = async () => {
    if (!data?.latest_assessment?.id) return;
    setSaving(true);
    try {
      await api.markReviewed(patientId, data.latest_assessment.id, clinicalNote);
      setSaved(true);
      // Update local state
      setData(prev => ({
        ...prev,
        latest_assessment: {
          ...prev.latest_assessment,
          needs_human_review: false,
          clinical_note: clinicalNote,
        }
      }));
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[180, 120, 100].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <AlertTriangle style={{ width: 32, height: 32, color: 'var(--amber)', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Error loading patient</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{error}</div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/patient-queue')}>
          <ArrowLeft size={13} /> Back to Queue
        </button>
      </div>
    );
  }

  const { patient, assessments, risk_history, health_reports, latest_assessment } = data;
  const scoreHistory = assessments.map(a => a.score);
  const riskScoreHistory = risk_history.map(r => r.risk_score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <button className="btn btn-ghost btn-xs" style={{ marginBottom: 8 }} onClick={() => navigate('/patient-queue')}>
            <ArrowLeft size={12} /> Back to Triage Queue
          </button>
          <div className="page-title">{patient.full_name}</div>
          <div className="page-subtitle" style={{ fontFamily: 'IBM Plex Mono' }}>{patient.email} · ID #{patient.id}</div>
        </div>
        {latest_assessment?.needs_human_review && (
          <span className="badge badge-amber" style={{ fontSize: 11, padding: '5px 12px' }}>
            <AlertTriangle style={{ width: 12, height: 12 }} /> Needs Review
          </span>
        )}
      </div>

      {/* ── LIVE SESSION PANEL ── */}
      <LiveSessionEmotionPanel patientId={patient.id} />

      {/* ── ROW 1: Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* PHQ-9 Score History */}
        <motion.div className="bento-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="section-title">PHQ-9 Score History</div>
          <TrendChart values={scoreHistory} color="var(--teal)" label="score /27" />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 8 }}>
            {assessments.length} assessments · Latest: {scoreHistory[scoreHistory.length - 1] ?? '—'}/27
          </div>
        </motion.div>

        {/* Risk Score Trend */}
        <motion.div className="bento-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="section-title">Risk Score Trend</div>
          <TrendChart values={riskScoreHistory} color="var(--amber)" label="risk score" />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 8 }}>
            {risk_history.length} risk records
          </div>
        </motion.div>
      </div>

      {/* ── ROW 2: Latest Assessment Breakdown ── */}
      {latest_assessment && (
        <motion.div className="bento-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Latest Assessment Breakdown</div>
            <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
              Score: <strong style={{ color: 'var(--text-primary)' }}>{latest_assessment.score}/27</strong> · {latest_assessment.risk_level}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Left: Sub-dimensions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DimensionBar label="Emotional" value={latest_assessment.emotional_score ?? 0} icon={Heart} color="var(--violet)" />
              <DimensionBar label="Cognitive" value={latest_assessment.cognitive_score ?? 0} icon={Brain} color="var(--cyan)" />
              <DimensionBar label="Physical" value={latest_assessment.physical_score ?? 0} icon={Activity} color="var(--amber)" />
              <DimensionBar label="Functional" value={latest_assessment.functional_score ?? 0} icon={Cpu} color="var(--emerald)" />

              {/* Dominant emotion */}
              {latest_assessment.dominant_emotion && (
                <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', marginBottom: 4 }}>Dominant Emotion</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{latest_assessment.dominant_emotion}</div>
                </div>
              )}
            </div>

            {/* Right: Tags */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Concern areas */}
              {latest_assessment.concern_areas?.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Tag style={{ width: 10, height: 10 }} /> Concern Areas
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {latest_assessment.concern_areas.map((c, i) => (
                      <span key={i} className="badge badge-amber">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk flags */}
              {latest_assessment.risk_flags?.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Shield style={{ width: 10, height: 10 }} /> Risk Flags
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {latest_assessment.risk_flags.map((f, i) => (
                      <span key={i} className="badge badge-rose">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mental state */}
              {latest_assessment.mental_state_label && (
                <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', marginBottom: 4 }}>Mental State</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{latest_assessment.mental_state_label.replace(/_/g, " ")}</div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── ROW 3: Health Reports ── */}
      {health_reports.length > 0 && (
        <motion.div className="bento-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <div className="section-title">Health Reports</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {health_reports.map(r => (
              <div key={r.id} style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <FileText style={{ width: 12, height: 12, color: 'var(--emerald)' }} />
                    {r.filename}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.summary && <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.summary}</div>}
                {r.diagnoses?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {r.diagnoses.map((d, i) => <span key={i} className="badge badge-muted">{d}</span>)}
                  </div>
                )}
                {r.medications?.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Medications: {r.medications.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── ROW 4: REVIEW ACTION ── */}
      {latest_assessment && (
        <motion.div
          className="bento-card"
          style={{ borderTop: '2px solid var(--emerald)' }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <div className="section-title">Clinical Review</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Clinical note field */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Clinical Note (free-text)
              </label>
              <textarea
                rows={4}
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
                placeholder="Write your clinical observations, follow-up instructions, or triage notes here..."
                style={{
                  width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                  borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)',
                  resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {latest_assessment.needs_human_review === false
                  ? <span style={{ color: 'var(--emerald)' }}>✓ Already marked as reviewed</span>
                  : "This assessment is flagged for human review."
                }
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ background: 'var(--emerald)', border: 'none' }}
                onClick={handleMarkReviewed}
                disabled={saving}
              >
                {saved ? (
                  <><CheckCircle2 size={13} /> Saved & Reviewed</>
                ) : saving ? (
                  "Saving..."
                ) : (
                  <><Save size={13} /> Mark Reviewed & Save Note</>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
