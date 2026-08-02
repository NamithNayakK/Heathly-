import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Calendar, ChevronRight, Clock,
  ClipboardList, FileText, Heart, Search, Stethoscope,
  TrendingUp, User, Users, Video, Zap
} from "lucide-react";
import { api } from "../lib/api";

// Mock data for features not yet backed by API
const MOCK_APPOINTMENTS = [
  { id: 1, patient: "Sarah Johnson", time: "10:00 AM", type: "Follow-up", status: "scheduled" },
  { id: 2, patient: "Michael Chen", time: "11:30 AM", type: "Initial Consultation", status: "in-progress" },
  { id: 3, patient: "Emily Davis", time: "2:00 PM", type: "PHQ-9 Review", status: "scheduled" },
  { id: 4, patient: "James Wilson", time: "3:30 PM", type: "Sensor Review", status: "scheduled" },
];

const MOCK_RECENT_NOTES = [
  { id: 1, patient: "Sarah Johnson", snippet: "Patient shows improvement in sleep patterns. Continue current treatment plan...", date: "2026-06-22" },
  { id: 2, patient: "Michael Chen", snippet: "Elevated stress index noted. Recommend mindfulness intervention...", date: "2026-06-21" },
  { id: 3, patient: "Emily Davis", snippet: "PHQ-9 score decreased from 14 to 9. Positive trajectory...", date: "2026-06-20" },
];

function getRiskColor(risk) {
  if (!risk) return 'var(--text-muted)';
  const r = risk.toLowerCase();
  if (r.includes('severe') || r.includes('high')) return 'var(--rose)';
  if (r.includes('moderate') || r.includes('medium')) return 'var(--amber)';
  return 'var(--emerald)';
}

function getRiskBadge(risk) {
  if (!risk) return 'badge-muted';
  const r = risk.toLowerCase();
  if (r.includes('severe') || r.includes('high')) return 'badge-rose';
  if (r.includes('moderate') || r.includes('medium')) return 'badge-amber';
  return 'badge-live';
}

export default function ConsultantDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const userName = sessionStorage.getItem("full_name") || localStorage.getItem("full_name") || "Doctor";

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getPatients();
        setPatients(data.patients || []);
      } catch (e) {
        console.error("Failed to load patients:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const highRiskCount = patients.filter(p => {
    const r = p.last_assessment?.risk_level?.toLowerCase() || '';
    return r.includes('severe') || r.includes('high');
  }).length;

  const mediumRiskCount = patients.filter(p => {
    const r = p.last_assessment?.risk_level?.toLowerCase() || '';
    return r.includes('moderate') || r.includes('medium');
  }).length;

  const lowRiskCount = patients.filter(p => {
    const r = p.last_assessment?.risk_level?.toLowerCase() || '';
    return r.includes('minimal') || r.includes('low') || r.includes('none');
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Consultant Dashboard</div>
          <div className="page-subtitle">Welcome back, Dr. {userName} — manage your patients and consultations</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/patient-queue')}>
            <Users style={{ width: 13, height: 13 }} /> Patient Queue
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/patient-sensor-view')}>
            <Activity style={{ width: 13, height: 13 }} /> Sensor Analysis
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-4" style={{ gap: 12 }}>
        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Total Patients</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--cyan-dim)' }}>
              <Users style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
            </div>
          </div>
          <span className="stat-value">{patients.length}</span>
        </div>

        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">High Risk</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--rose-dim)' }}>
              <AlertTriangle style={{ width: 14, height: 14, color: 'var(--rose)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ color: highRiskCount > 0 ? 'var(--rose)' : 'var(--text-primary)' }}>{highRiskCount}</span>
        </div>

        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Moderate Risk</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--amber-dim)' }}>
              <TrendingUp style={{ width: 14, height: 14, color: 'var(--amber)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ color: 'var(--amber)' }}>{mediumRiskCount}</span>
        </div>

        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Low Risk</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--emerald-dim)' }}>
              <Heart style={{ width: 14, height: 14, color: 'var(--emerald)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ color: 'var(--emerald)' }}>{lowRiskCount}</span>
        </div>
      </div>

      {/* Main Content: Patient Queue + Appointments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* Patient Queue */}
        <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Patient Overview</div>
            <button className="btn btn-ghost btn-xs" onClick={() => navigate('/patient-queue')}>
              View All <ChevronRight style={{ width: 11, height: 11 }} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 38 }}
              placeholder="Search patients by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : filteredPatients.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {filteredPatients.slice(0, 8).map(patient => (
                <div
                  key={patient.id}
                  className="agent-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/patient-sensor-view?patient=${patient.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${getRiskColor(patient.last_assessment?.risk_level)}, var(--blue))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
                    }}>
                      {patient.full_name?.charAt(0)?.toUpperCase() || 'P'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {patient.full_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                        {patient.sensor_records} sensor records
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {patient.last_assessment ? (
                      <span className={`badge ${getRiskBadge(patient.last_assessment.risk_level)}`}>
                        {patient.last_assessment.risk_level}
                      </span>
                    ) : (
                      <span className="badge badge-muted">No assessment</span>
                    )}
                    <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {searchTerm ? 'No patients match your search.' : 'No patients registered yet.'}
            </div>
          )}
        </div>

        {/* Appointments & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Today's Appointments */}
          <div className="card card-accent-blue" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Today's Schedule</div>
              <button className="btn btn-ghost btn-xs" onClick={() => navigate('/appointments')}>
                Calendar <ChevronRight style={{ width: 11, height: 11 }} />
              </button>
            </div>
            {MOCK_APPOINTMENTS.map(apt => (
              <div key={apt.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: apt.status === 'in-progress' ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${apt.status === 'in-progress' ? 'rgba(16,185,129,0.15)' : 'var(--bg-border)'}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: apt.status === 'in-progress' ? 'var(--emerald)' : 'var(--text-muted)',
                  boxShadow: apt.status === 'in-progress' ? '0 0 6px var(--emerald)' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.patient}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{apt.type}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <Clock style={{ width: 10, height: 10 }} />
                  {apt.time}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Quick Actions</div>
            {[
              { label: 'View Patient Sensors', icon: Activity, path: '/patient-sensor-view', color: 'var(--cyan)' },
              { label: 'Consultation Notes', icon: FileText, path: '/consultation-notes', color: 'var(--emerald)' },
              { label: 'Patient Queue', icon: ClipboardList, path: '/patient-queue', color: 'var(--blue)' },
              { label: 'Appointments', icon: Calendar, path: '/appointments', color: 'var(--violet)' },
            ].map(action => (
              <button
                key={action.label}
                className="agent-card"
                style={{ cursor: 'pointer', background: 'none', width: '100%', textAlign: 'left' }}
                onClick={() => navigate(action.path)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ padding: 5, borderRadius: 6, background: `${action.color}15` }}>
                    <action.icon style={{ width: 13, height: 13, color: action.color }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{action.label}</span>
                </div>
                <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Clinical Notes */}
      <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Recent Clinical Notes</div>
          <button className="btn btn-ghost btn-xs" onClick={() => navigate('/consultation-notes')}>
            View All <ChevronRight style={{ width: 11, height: 11 }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {MOCK_RECENT_NOTES.map(note => (
            <div key={note.id} className="card card-xs" style={{ background: 'var(--bg-elevated)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{note.patient}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{note.date}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {note.snippet}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
