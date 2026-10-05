import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ChevronRight, Eye, Search, Shield, Users
} from "lucide-react";
import { api } from "../lib/api";

export default function PatientQueuePage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getTriageQueue();
        setPatients(data.patients || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = patients.filter(p =>
    (p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const riskBadge = (level) => {
    if (!level) return <span className="badge badge-muted">No data</span>;
    const l = level.toLowerCase();
    if (l.includes("severe")) return <span className="badge badge-rose">{level}</span>;
    if (l.includes("high")) return <span className="badge badge-rose">{level}</span>;
    if (l.includes("moderate")) return <span className="badge badge-amber">{level}</span>;
    return <span className="badge badge-live">{level}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield style={{ width: 20, height: 20, color: 'var(--emerald)' }} />
          <div className="page-title">Triage Queue</div>
        </div>
        <div className="page-subtitle">
          Patients flagged for review — High risk, Severe assessments, or AI-flagged needs_human_review
        </div>
      </div>

      {error && (
        <div className="alert alert-warn">
          <AlertTriangle size={14} /> <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 38 }}
            placeholder="Search flagged patients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
          <Users style={{ width: 12, height: 12 }} />
          {patients.length} flagged
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 14 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-editorial-dark" style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', marginBottom: 4 }}>
            {searchTerm ? 'No matching patients found' : 'Triage Queue Clear'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {searchTerm ? 'Try adjusting your search criteria.' : 'All registered patients are currently within baseline thresholds.'}
          </div>
        </div>
      ) : (
        <div className="bento-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--bg-border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ padding: '16px 20px' }}>Patient Profile</th>
                <th>Stratified Risk</th>
                <th>PHQ-9 Index</th>
                <th>Last Interaction</th>
                <th>Review Status</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Clinical Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(patient => (
                <tr key={patient.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Patient Profile */}
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(29, 107, 95, 0.25)',
                        border: '1px solid rgba(29, 107, 95, 0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: 'var(--teal)', flexShrink: 0
                      }}>
                        {patient.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: '#FFFFFF', fontSize: 14 }}>{patient.full_name}</span>
                          {patient.is_unassigned_fallback && (
                            <span className="badge badge-rose" style={{ fontSize: 9 }}>
                              Urgent
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>
                          {patient.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Risk State */}
                  <td>{riskBadge(patient.latest_risk_level)}</td>

                  {/* PHQ-9 Score */}
                  <td style={{ fontWeight: 600, color: '#FFFFFF', fontFamily: 'IBM Plex Mono', fontSize: 14 }}>
                    {patient.latest_score != null ? `${patient.latest_score} / 27` : '—'}
                  </td>

                  {/* Last Assessment */}
                  <td style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
                    {patient.last_assessment_date
                      ? new Date(patient.last_assessment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>

                  {/* Review Status */}
                  <td>
                    {patient.needs_review ? (
                      <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle style={{ width: 10, height: 10 }} />
                        Needs Review
                      </span>
                    ) : (
                      <span className="badge badge-live">Reviewed</span>
                    )}
                  </td>

                  {/* Action */}
                  <td style={{ textAlign: 'right', paddingRight: 20 }}>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => navigate(`/patient-detail?patient=${patient.id}`)}
                      style={{ background: 'var(--brand)', color: '#FFFFFF', borderColor: 'transparent', padding: '6px 14px' }}
                    >
                      <Eye style={{ width: 12, height: 12 }} />
                      Open Dossier
                      <ChevronRight style={{ width: 11, height: 11 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

