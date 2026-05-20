import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, ChevronRight,
  ClipboardList, Clock, Cpu, FileText, MessageSquare, RefreshCw,
  Shield, TrendingUp, Upload, Zap
} from "lucide-react";
import { api } from "../lib/api";

const AGENTS = [
  { name: "NLP Agent", model: "DistilBERT", status: "live" },
  { name: "Fusion Agent", model: "Attention Engine", status: "live" },
  { name: "Safety Agent", model: "Rule + XGBoost", status: "live" },
  { name: "Sensor Agent", model: "BiLSTM", status: "idle" },
  { name: "Bias Detection", model: "Fairness Monitor", status: "idle" },
];

const MODALITY_CARDS = [
  { label: "PHQ-9 Analysis", icon: ClipboardList, color: "var(--cyan)", path: "/assessment" },
  { label: "Medical Records", icon: FileText, color: "var(--emerald)", path: "/health-report" },
  { label: "Chat Intelligence", icon: MessageSquare, color: "var(--violet)", path: "/chat" },
  { label: "Sensor Streams", icon: Activity, color: "var(--blue)", path: "/sensor" },
];

function StatCard({ label, value, unit, icon: Icon, color, trend }) {
  return (
    <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="stat-label">{label}</span>
        <div style={{ padding: 6, borderRadius: 6, background: `${color}18` }}>
          <Icon style={{ width: 14, height: 14, color }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="stat-value">{value}</span>
        {unit && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--emerald)' }}>
          <TrendingUp style={{ width: 11, height: 11 }} />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

function AgentRow({ name, model, status }) {
  return (
    <div className="agent-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className={`status-dot ${status}`} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{model}</div>
        </div>
      </div>
      <span className={`badge ${status === 'live' ? 'badge-live' : 'badge-muted'}`}>
        {status}
      </span>
    </div>
  );
}

function WellnessRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (score || 0) / 100);
  const color = score >= 75 ? 'var(--emerald)' : score >= 50 ? 'var(--cyan)' : 'var(--amber)';

  return (
    <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', lineHeight: 1 }}>
          {score ?? '--'}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono' }}>
          Wellness
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dashData, setDashData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadText, setUploadText] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState([]);
  const userName = localStorage.getItem('full_name') || 'User';

  const load = async () => {
    setLoading(true);
    try {
      const [dash, hist] = await Promise.all([api.getMultimodalDashboard(), api.getPHQ9History()]);
      setDashData(dash);
      setHistory(hist.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadText(ev.target?.result || '');
    reader.readAsText(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadText.trim()) return;
    setUploading(true);
    setUploadLog([]);
    const steps = ['Initializing OCR pipeline...', 'Running BioClinicalBERT entity extraction...', 'Mapping clinical entities to wellness model...'];
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 500));
      setUploadLog(prev => [...prev, s]);
    }
    try {
      await api.submitHealthReport(uploadFile?.name || 'manual-entry.txt', uploadText.trim());
      setUploadLog(prev => [...prev, '✓ Report integrated successfully.']);
      setTimeout(() => { setUploadFile(null); setUploadText(''); setUploadLog([]); load(); }, 2000);
    } catch (err) {
      setUploadLog(prev => [...prev, `✗ Error: ${err.message}`]);
    } finally {
      setUploading(false);
    }
  };

  const wellness = dashData?.unified_wellness_index ?? null;
  const risk = dashData?.risk_classification || 'Unknown';
  const explainability = dashData?.explainability_layer || [];
  const alerts = dashData?.alert_flags || [];
  const recommendations = dashData?.recommendations || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Clinical Intelligence Dashboard</div>
          <div className="page-subtitle">Unified multimodal health analytics for {userName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            <RefreshCw style={{ width: 13, height: 13, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/assessment')}>
            <ClipboardList style={{ width: 13, height: 13 }} />
            New Assessment
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && alerts.map((a, i) => (
        <div key={i} className="alert alert-error">
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <span>{a}</span>
        </div>
      ))}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[200, 120, 80].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Main Wellness + Agents Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

            {/* Live Wellness Pulse */}
            <div className="card card-accent-cyan" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <WellnessRing score={wellness} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 6 }}>Live Wellness Pulse</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                      {risk} Risk
                    </span>
                    <span className={`badge ${risk?.toLowerCase() === 'low' ? 'badge-live' : risk?.toLowerCase() === 'medium' ? 'badge-amber' : 'badge-rose'}`}>
                      {wellness !== null ? `${wellness}% index` : 'Pending'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Synthesized across {dashData?.modes_active?.length || 0} active telemetry streams including clinical BERT models, wearable sensors, and conversation semantics.
                  </div>
                </div>

                {/* Attention Fusion weights */}
                {explainability.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="section-title">Attention Fusion Matrix</div>
                    {explainability.map((item, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'IBM Plex Mono' }}>
                            {item.modality?.replace(/_/g, ' ')}
                          </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'IBM Plex Mono' }}>
                            {((item.weight || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="meter-bar">
                          <div className="meter-fill" style={{ width: `${(item.weight || 0) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div>
                    <div className="section-title">AI Recommendations</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {recommendations.slice(0, 2).map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                          <CheckCircle2 style={{ width: 12, height: 12, color: 'var(--emerald)', flexShrink: 0, marginTop: 3 }} />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Agent Status */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>AI Agent Status</div>
                <span className="badge badge-live"><span className="status-dot live" style={{ width: 5, height: 5 }} />Live</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AGENTS.map(a => <AgentRow key={a.name} {...a} />)}
              </div>
              <div className="divider" style={{ margin: '4px 0' }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                Last sync: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Modality Status Grid */}
          <div>
            <div className="section-title">Multimodal Intelligence Streams</div>
            <div className="grid-4" style={{ gap: 12 }}>
              {MODALITY_CARDS.map(m => (
                <button
                  key={m.label}
                  className="card card-xs"
                  style={{ cursor: 'pointer', textAlign: 'left', background: 'none' }}
                  onClick={() => navigate(m.path)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <m.icon style={{ width: 16, height: 16, color: m.color }} />
                    <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Active</div>
                </button>
              ))}
            </div>
          </div>

          {/* Record Upload + History Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>

            {/* Inline Record Upload */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
              {uploading && <div className="neon-scanner" />}
              <div className="section-title">Upload Clinical Record</div>
              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label className="upload-zone" style={{ display: 'block' }}>
                  <Upload style={{ width: 20, height: 20, color: 'var(--cyan)', marginBottom: 8 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {uploadFile ? uploadFile.name : 'Drop report or click to browse'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TXT, MD, CSV, JSON · max 5MB</div>
                  <input type="file" className="sr-only" style={{ display: 'none' }} onChange={handleFileChange} />
                </label>
                {uploadLog.length > 0 && (
                  <div className="terminal" style={{ maxHeight: 80 }}>
                    {uploadLog.map((l, i) => (
                      <div key={i} className={l.startsWith('✓') ? 'terminal-line-success' : l.startsWith('✗') ? 'terminal-line-error' : 'terminal-line-info'}>
                        {l}
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary btn-sm" type="submit" disabled={uploading || !uploadFile} style={{ width: '100%' }}>
                  {uploading ? 'Analyzing...' : 'Run Clinical Analysis'}
                </button>
              </form>
            </div>

            {/* Assessment History */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Diagnostic History</div>
                <button className="btn btn-ghost btn-xs" onClick={() => navigate('/assessment')}>
                  New run <ChevronRight style={{ width: 11, height: 11 }} />
                </button>
              </div>
              {history.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>PHQ Score</th>
                      <th>Risk Level</th>
                      <th>Classifier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 5).map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.score} / 27</td>
                        <td>
                          <span className={`badge ${
                            item.risk_level?.toLowerCase().includes('severe') ? 'badge-rose' :
                            item.risk_level?.toLowerCase().includes('moderate') ? 'badge-amber' :
                            'badge-live'
                          }`}>{item.risk_level}</span>
                        </td>
                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>
                          {item.agent_version || 'agentic-phq9'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No assessments recorded. Start your first diagnostic run.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
