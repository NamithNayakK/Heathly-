import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeft, Battery, Brain,
  ChevronDown, ChevronRight, Heart, Search, TrendingUp,
  User, Zap
} from "lucide-react";
import { api } from "../lib/api";

function SensorGauge({ label, value, unit, min, max, color, icon: Icon }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="card card-xs" style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em' }}>{label}</span>
        <Icon style={{ width: 14, height: 14, color }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{value?.toFixed(1) ?? '—'}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>
      </div>
      <div className="meter-bar" style={{ height: 4 }}>
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function PatientSensorViewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get('patient') || '');
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load patient list
  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await api.getPatients();
        setPatients(data.patients || []);
      } catch (e) {
        console.error("Failed to load patients:", e);
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, []);

  // Load sensor data when patient is selected
  useEffect(() => {
    if (!selectedPatientId) {
      setSensorData(null);
      return;
    }
    const loadSensor = async () => {
      setSensorLoading(true);
      try {
        const data = await api.getPatientSensorData(selectedPatientId);
        setSensorData(data);
      } catch (e) {
        console.error("Failed to load sensor data:", e);
        setSensorData(null);
      } finally {
        setSensorLoading(false);
      }
    };
    loadSensor();
    setSearchParams({ patient: selectedPatientId });
  }, [selectedPatientId]);

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPatient = patients.find(p => String(p.id) === String(selectedPatientId));

  // Aggregate sensor data for latest reading & history
  const latestSensor = sensorData?.sensor_records?.[0] || null;
  const sensorHistory = sensorData?.sensor_records || [];

  // Calculate averages
  const avgHRV = sensorHistory.length > 0
    ? sensorHistory.reduce((sum, r) => sum + r.heart_rate_variability, 0) / sensorHistory.length
    : null;
  const avgStress = sensorHistory.length > 0
    ? sensorHistory.reduce((sum, r) => sum + r.stress_index, 0) / sensorHistory.length
    : null;
  const avgSleep = sensorHistory.length > 0
    ? sensorHistory.reduce((sum, r) => sum + r.sleep_duration_hours, 0) / sensorHistory.length
    : null;
  const avgGSR = sensorHistory.length > 0
    ? sensorHistory.reduce((sum, r) => sum + r.galvanic_skin_response, 0) / sensorHistory.length
    : null;

  const getRiskColor = (level) => {
    if (!level) return 'var(--text-muted)';
    const l = level.toLowerCase();
    if (l.includes('severe') || l.includes('high')) return 'var(--rose)';
    if (l.includes('moderate') || l.includes('medium')) return 'var(--amber)';
    return 'var(--emerald)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <button className="btn btn-ghost btn-xs" onClick={() => navigate('/dashboard')}>
              <ArrowLeft style={{ width: 12, height: 12 }} /> Dashboard
            </button>
          </div>
          <div className="page-title">Patient Sensor Analysis</div>
          <div className="page-subtitle">Select a patient by name to view their physiological telemetry data</div>
        </div>
      </div>

      {/* Patient Selector */}
      <div className="card card-accent-cyan" style={{ position: 'relative' }}>
        <div className="section-title" style={{ marginBottom: 10 }}>Select Patient</div>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--bg-elevated)',
              border: `1.5px solid ${dropdownOpen ? 'var(--cyan)' : 'var(--bg-border)'}`,
              cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: dropdownOpen ? '0 0 12px var(--cyan-dim)' : 'none',
            }}
          >
            {selectedPatient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--cyan), var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                }}>
                  {selectedPatient.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedPatient.full_name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                    {selectedPatient.email} · {selectedPatient.sensor_records} records
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click to select a patient...</span>
              </div>
            )}
            <ChevronDown style={{
              width: 16, height: 16, color: 'var(--text-muted)',
              transition: 'transform 0.2s ease',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }} />
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
              borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              zIndex: 100, overflow: 'hidden',
              maxHeight: 320,
            }}>
              {/* Search */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-border)' }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-muted)' }} />
                  <input
                    className="input-field"
                    style={{ paddingLeft: 32, fontSize: 12, padding: '7px 10px 7px 32px' }}
                    placeholder="Search by patient name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Patient List */}
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading patients...</div>
                ) : filteredPatients.length > 0 ? (
                  filteredPatients.map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatientId(String(patient.id));
                        setDropdownOpen(false);
                        setSearchTerm("");
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px',
                        background: String(patient.id) === String(selectedPatientId) ? 'var(--cyan-dim)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { if (String(patient.id) !== String(selectedPatientId)) e.target.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { if (String(patient.id) !== String(selectedPatientId)) e.target.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--emerald), var(--blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {patient.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{patient.full_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                          {patient.sensor_records} sensor records · {patient.last_assessment?.risk_level || 'No assessment'}
                        </div>
                      </div>
                      {String(patient.id) === String(selectedPatientId) && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />
                      )}
                    </button>
                  ))
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    {searchTerm ? 'No patients found matching your search.' : 'No patients registered yet.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sensor Data Display */}
      {sensorLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[160, 100, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />)}
        </div>
      ) : sensorData && selectedPatient ? (
        <>
          {/* Patient Info Banner */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#fff',
              }}>
                {sensorData.patient?.full_name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {sensorData.patient?.full_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {sensorData.patient?.email}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {sensorData.last_assessment && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Last Assessment</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                      {sensorData.last_assessment.score}/27
                    </span>
                    <span className={`badge ${
                      sensorData.last_assessment.risk_level?.toLowerCase().includes('severe') ? 'badge-rose' :
                      sensorData.last_assessment.risk_level?.toLowerCase().includes('moderate') ? 'badge-amber' : 'badge-live'
                    }`}>
                      {sensorData.last_assessment.risk_level}
                    </span>
                  </div>
                </div>
              )}
              <div style={{ width: 1, height: 36, background: 'var(--bg-border)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Sensor Records</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'IBM Plex Sans', marginTop: 2 }}>
                  {sensorHistory.length}
                </div>
              </div>
            </div>
          </div>

          {/* Latest Reading Gauges */}
          {latestSensor ? (
            <>
              <div>
                <div className="section-title">Latest Physiological Reading</div>
                <div className="grid-4" style={{ gap: 12 }}>
                  <SensorGauge
                    label="Heart Rate Variability"
                    value={latestSensor.heart_rate_variability}
                    unit="ms" min={10} max={120}
                    color="var(--rose)"
                    icon={Heart}
                  />
                  <SensorGauge
                    label="Galvanic Skin Response"
                    value={latestSensor.galvanic_skin_response}
                    unit="μS" min={0} max={20}
                    color="var(--cyan)"
                    icon={Activity}
                  />
                  <SensorGauge
                    label="Sleep Duration"
                    value={latestSensor.sleep_duration_hours}
                    unit="hrs" min={0} max={12}
                    color="var(--blue)"
                    icon={Battery}
                  />
                  <SensorGauge
                    label="Stress Index"
                    value={latestSensor.stress_index}
                    unit="" min={0} max={1}
                    color={latestSensor.stress_index >= 0.7 ? 'var(--rose)' : latestSensor.stress_index >= 0.4 ? 'var(--amber)' : 'var(--emerald)'}
                    icon={Brain}
                  />
                </div>
              </div>

              {/* Averages */}
              <div className="card card-accent-blue" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Historical Averages ({sensorHistory.length} readings)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Avg HRV', value: avgHRV?.toFixed(1), unit: 'ms', color: 'var(--rose)' },
                    { label: 'Avg GSR', value: avgGSR?.toFixed(2), unit: 'μS', color: 'var(--cyan)' },
                    { label: 'Avg Sleep', value: avgSleep?.toFixed(1), unit: 'hrs', color: 'var(--blue)' },
                    { label: 'Avg Stress', value: avgStress?.toFixed(2), unit: '', color: avgStress >= 0.7 ? 'var(--rose)' : avgStress >= 0.4 ? 'var(--amber)' : 'var(--emerald)' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em', marginBottom: 4 }}>
                        {item.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: 'IBM Plex Sans' }}>{item.value ?? '—'}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stress Trend Analysis */}
              <div className="card card-accent-rose" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Stress Trend Analysis</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    padding: '6px 12px', borderRadius: 8,
                    background: avgStress >= 0.7 ? 'var(--rose-dim)' : avgStress >= 0.4 ? 'var(--amber-dim)' : 'var(--emerald-dim)',
                    border: `1px solid ${avgStress >= 0.7 ? 'rgba(244,63,94,0.2)' : avgStress >= 0.4 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: avgStress >= 0.7 ? 'var(--rose)' : avgStress >= 0.4 ? 'var(--amber)' : 'var(--emerald)',
                    }}>
                      {avgStress >= 0.7 ? '⚠ High Stress Pattern' : avgStress >= 0.4 ? '◎ Moderate Stress' : '✓ Low Stress Pattern'}
                    </span>
                  </div>
                  {sensorData.last_assessment?.mental_state_label && (
                    <span className="badge badge-violet">{sensorData.last_assessment.mental_state_label}</span>
                  )}
                  {sensorData.last_assessment?.dominant_emotion && (
                    <span className="emotion-chip">{sensorData.last_assessment.dominant_emotion}</span>
                  )}
                </div>

                {/* Mini bar chart of stress values */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
                  {sensorHistory.slice(0, 20).reverse().map((record, i) => {
                    const height = Math.max(4, record.stress_index * 60);
                    const color = record.stress_index >= 0.7 ? 'var(--rose)' : record.stress_index >= 0.4 ? 'var(--amber)' : 'var(--emerald)';
                    return (
                      <div
                        key={i}
                        title={`Stress: ${(record.stress_index * 100).toFixed(0)}% — ${new Date(record.created_at).toLocaleDateString()}`}
                        style={{
                          flex: 1, height, borderRadius: '3px 3px 0 0',
                          background: color, opacity: 0.7,
                          transition: 'opacity 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.7}
                      />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                  <span>Oldest</span>
                  <span>Most Recent</span>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Activity style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>No Sensor Data Available</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                This patient has no recorded physiological sensor data yet.
              </div>
            </div>
          )}

          {/* Sensor History Table */}
          {sensorHistory.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Sensor Data History</div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>HRV (ms)</th>
                      <th>GSR (μS)</th>
                      <th>Sleep (hrs)</th>
                      <th>Stress Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensorHistory.map((record, i) => (
                      <tr key={record.id || i}>
                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
                          {record.created_at ? new Date(record.created_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {record.heart_rate_variability?.toFixed(1)}
                        </td>
                        <td>{record.galvanic_skin_response?.toFixed(2)}</td>
                        <td>{record.sleep_duration_hours?.toFixed(1)}</td>
                        <td>
                          <span className={`badge ${
                            record.stress_index >= 0.7 ? 'badge-rose' :
                            record.stress_index >= 0.4 ? 'badge-amber' : 'badge-live'
                          }`}>
                            {(record.stress_index * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : !selectedPatientId ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--cyan-dim)', border: '1px solid rgba(6,182,212,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <User style={{ width: 24, height: 24, color: 'var(--cyan)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Select a Patient
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            Use the patient selector above to choose a patient by name. Once selected, their full physiological sensor telemetry will be displayed here.
          </div>
        </div>
      ) : null}
    </div>
  );
}
