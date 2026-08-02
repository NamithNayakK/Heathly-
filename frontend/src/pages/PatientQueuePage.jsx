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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {searchTerm ? 'No patients match your search.' : 'No patients currently flagged for review. All clear.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Risk Level</th>
                <th>PHQ-9 Score</th>
                <th>Last Assessment</th>
                <th>Review Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(patient => (
                <tr key={patient.id}>
                  {/* Patient name + avatar */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--emerald), var(--blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
                      }}>
                        {patient.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{patient.full_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{patient.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Risk level badge */}
                  <td>{riskBadge(patient.latest_risk_level)}</td>

                  {/* PHQ-9 score */}
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>
                    {patient.latest_score != null ? `${patient.latest_score}/27` : '—'}
                  </td>

                  {/* Last assessment date */}
                  <td style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
                    {patient.last_assessment_date
                      ? new Date(patient.last_assessment_date).toLocaleDateString()
                      : '—'}
                  </td>

                  {/* Needs review badge */}
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

                  {/* Action button */}
                  <td>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => navigate(`/patient-detail?patient=${patient.id}`)}
                    >
                      <Eye style={{ width: 11, height: 11 }} />
                      View Detail
                      <ChevronRight style={{ width: 10, height: 10 }} />
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
