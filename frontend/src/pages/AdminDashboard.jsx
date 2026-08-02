import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, BarChart2, Check, CheckCircle2,
  ChevronRight, Clock, Cpu, FileText, Filter, MessageSquare,
  RefreshCw, Search, Shield, ShieldAlert, ShieldCheck,
  Smartphone, Trash2, User, UserCheck, UserCog, Users, Zap
} from "lucide-react";
import { api } from "../lib/api";

// Config-driven static model status definitions
const MODEL_CONFIGS = [
  {
    id: "xgboost",
    name: "XGBoost Risk Classifier",
    category: "Clinical Risk",
    status: "Active",
    metricLabel: "Accuracy",
    metricValue: "94%",
    description: "Evaluates multidimensional clinical risk level from patient telemetry and survey data.",
    badgeClass: "badge-live",
    color: "var(--emerald)",
  },
  {
    id: "distilbert",
    name: "DistilBERT Emotion Classifier",
    category: "NLP & Sentiment",
    status: "Active",
    metricLabel: "Accuracy",
    metricValue: "77%",
    description: "Transformer model analyzing free-text journal entries and conversation semantics.",
    badgeClass: "badge-live",
    color: "var(--teal)",
  },
  {
    id: "lstm",
    name: "LSTM Mental State Classifier",
    category: "Temporal State",
    status: "Active",
    metricLabel: "Accuracy",
    metricValue: "69%",
    description: "Recurrent neural network tracking longitudinal mood trends over time.",
    badgeClass: "badge-live",
    color: "var(--cyan)",
  },
  {
    id: "sensorbilstm",
    name: "SensorBiLSTM (Multimodal)",
    category: "Biometric Telemetry",
    status: "Prototype",
    metricLabel: "Dataset",
    metricValue: "Prototype - synthetic training data",
    description: "Bi-directional LSTM fusing continuous physiological sensor telemetry.",
    badgeClass: "badge-amber",
    color: "var(--amber)",
  },
  {
    id: "deepface",
    name: "DeepFaceCNN (Facial Emotion)",
    category: "Computer Vision",
    status: "Prototype",
    metricLabel: "Dataset",
    metricValue: "Prototype - synthetic training data",
    description: "Convolutional neural network for facial landmark & micro-expression detection.",
    badgeClass: "badge-amber",
    color: "var(--rose)",
  },
  {
    id: "wav2vec2",
    name: "Wav2Vec2 (Speech Emotion)",
    category: "Audio Processing",
    status: "Prototype",
    metricLabel: "Dataset",
    metricValue: "Prototype - synthetic training data",
    description: "Acoustic speech embedding model for vocal tone and affect analysis.",
    badgeClass: "badge-amber",
    color: "var(--violet)",
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [flaggedPosts, setFlaggedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);

  // User management state
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pairingFilter, setPairingFilter] = useState("all");
  const [editingUserId, setEditingUserId] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [updatingUser, setUpdatingUser] = useState(false);

  const userName = sessionStorage.getItem("full_name") || localStorage.getItem("full_name") || "Admin";

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, flaggedData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getFlaggedForumPosts().catch(() => ({ items: [] })),
      ]);
      setStats(statsData);
      setUsers(usersData.users || []);
      setFlaggedPosts(flaggedData.items || []);
    } catch (e) {
      console.error("Admin dashboard load error:", e);
      showMessage("Error loading admin data: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (msg, type = "success") => {
    setActionMessage({ text: msg, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // User Role Update Handler
  const handleSaveRole = async (userId) => {
    if (!selectedRole) return;
    setUpdatingUser(true);
    try {
      await api.updateUserRole(userId, selectedRole);
      setEditingUserId(null);
      showMessage(`User role updated to "${selectedRole}".`);
      loadData();
    } catch (e) {
      showMessage("Failed to update user role: " + e.message, "error");
    } finally {
      setUpdatingUser(false);
    }
  };

  // Forum Moderation Handlers
  const handleApprovePost = async (postId) => {
    try {
      await api.approveForumPost(postId);
      setFlaggedPosts((prev) => prev.filter((p) => p.id !== postId));
      showMessage("Forum post approved and unflagged.");
    } catch (e) {
      showMessage("Failed to approve post: " + e.message, "error");
    }
  };

  const handleRemovePost = async (postId) => {
    if (!window.confirm("Are you sure you want to permanently remove this post?")) return;
    try {
      await api.deleteForumPost(postId);
      setFlaggedPosts((prev) => prev.filter((p) => p.id !== postId));
      showMessage("Forum post permanently removed.");
    } catch (e) {
      showMessage("Failed to remove post: " + e.message, "error");
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchSearch = u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchPairing =
      pairingFilter === "all" ||
      (pairingFilter === "paired" && u.paired) ||
      (pairingFilter === "unpaired" && !u.paired);
    return matchSearch && matchRole && matchPairing;
  });

  // Calculate Risk Distribution percentages
  const riskDist = stats?.risk_distribution || { Low: 0, Medium: 0, High: 0, Unassessed: 0 };
  const totalEvaluatedPatients = (riskDist.Low || 0) + (riskDist.Medium || 0) + (riskDist.High || 0) + (riskDist.Unassessed || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header Banner */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge badge-lav" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <Shield style={{ width: 12, height: 12 }} /> Admin Workspace
            </span>
          </div>
          <div className="page-title" style={{ marginTop: 4 }}>Platform Administration</div>
          <div className="page-subtitle">
            System control panel, risk overview, user role management & forum moderation — {userName}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            <RefreshCw style={{ width: 13, height: 13, ...(loading ? { animation: "spin 1s linear infinite" } : {}) }} />
            Refresh Data
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`alert ${actionMessage.type === "error" ? "alert-error" : "alert-success"}`}>
          {actionMessage.type === "error" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {loading && !stats ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[160, 240, 200].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <>
          {/* =========================================================================
              SECTION 1: SYSTEM-WIDE RISK OVERVIEW & ACCESSIBILITY STATS
             ========================================================================= */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Activity style={{ width: 16, height: 16, color: "var(--teal)" }} />
              <div className="section-title" style={{ marginBottom: 0 }}>System-Wide Risk & Platform Overview</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {/* User Roles Card */}
              <div className="card card-sm" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: "3px solid var(--cyan)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="stat-label">User Accounts by Role</span>
                  <Users style={{ width: 16, height: 16, color: "var(--cyan)" }} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "8px 0", fontFamily: "IBM Plex Sans" }}>
                  {stats?.total_users || 0} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>Total</span>
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, borderTop: "1px solid var(--bg-border)", paddingTop: 8 }}>
                  <span style={{ color: "var(--emerald)" }}><strong>{stats?.patients || 0}</strong> Patients</span>
                  <span style={{ color: "var(--blue)" }}><strong>{stats?.consultants || 0}</strong> Consultants</span>
                  <span style={{ color: "var(--violet)" }}><strong>{stats?.admins || 0}</strong> Admins</span>
                </div>
              </div>

              {/* Patient Risk Distribution Card */}
              <div className="card card-sm" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: "3px solid var(--amber)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="stat-label">Patient Risk Distribution</span>
                  <ShieldAlert style={{ width: 16, height: 16, color: "var(--amber)" }} />
                </div>
                <div style={{ margin: "8px 0" }}>
                  <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bg-elevated)", gap: 2 }}>
                    <div style={{ width: `${totalEvaluatedPatients ? (riskDist.Low / totalEvaluatedPatients) * 100 : 0}%`, background: "var(--emerald)" }} title={`Low Risk: ${riskDist.Low}`} />
                    <div style={{ width: `${totalEvaluatedPatients ? (riskDist.Medium / totalEvaluatedPatients) * 100 : 0}%`, background: "var(--amber)" }} title={`Medium Risk: ${riskDist.Medium}`} />
                    <div style={{ width: `${totalEvaluatedPatients ? (riskDist.High / totalEvaluatedPatients) * 100 : 0}%`, background: "var(--rose)" }} title={`High Risk: ${riskDist.High}`} />
                    <div style={{ width: `${totalEvaluatedPatients ? (riskDist.Unassessed / totalEvaluatedPatients) * 100 : 0}%`, background: "var(--text-muted)" }} title={`Unassessed: ${riskDist.Unassessed}`} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>
                  <span style={{ color: "var(--emerald)" }}>Low: {riskDist.Low}</span>
                  <span style={{ color: "var(--amber)" }}>Med: {riskDist.Medium}</span>
                  <span style={{ color: "var(--rose)" }}>High: {riskDist.High}</span>
                </div>
              </div>

              {/* Unresolved Reviews Card */}
              <div className="card card-sm" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: "3px solid var(--rose)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="stat-label">Pending Clinical Reviews</span>
                  <AlertTriangle style={{ width: 16, height: 16, color: "var(--rose)" }} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0" }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: (stats?.unresolved_reviews_count || 0) > 0 ? "var(--rose)" : "var(--emerald)", fontFamily: "IBM Plex Sans" }}>
                    {stats?.unresolved_reviews_count || 0}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>needs human review</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>
                  {(stats?.unresolved_reviews_count || 0) > 0 ? "Requires consultant attention" : "All flagged cases resolved"}
                </div>
              </div>

              {/* Assessments Submitted Card */}
              <div className="card card-sm" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: "3px solid var(--violet)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="stat-label">PHQ-9 Assessments</span>
                  <BarChart2 style={{ width: 16, height: 16, color: "var(--violet)" }} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "8px 0" }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", fontFamily: "IBM Plex Sans" }}>
                    {stats?.assessments_submitted?.all_time || stats?.total_assessments || 0}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>All-Time</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--teal)", fontWeight: 500, fontFamily: "IBM Plex Mono" }}>
                  +{stats?.assessments_submitted?.last_7_days || 0} submitted in last 7 days
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 2: USER MANAGEMENT TABLE
             ========================================================================= */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserCog style={{ width: 18, height: 18, color: "var(--cyan)" }} />
                <div>
                  <div className="section-title" style={{ marginBottom: 0 }}>User Management</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Inspect accounts, manage role permissions & monitor telemetry device pairing</div>
                </div>
              </div>
              <span className="badge badge-muted" style={{ fontFamily: "IBM Plex Mono" }}>
                Showing {filteredUsers.length} of {users.length} Users
              </span>
            </div>

            {/* Controls Bar */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-muted)" }} />
                <input
                  className="input-field"
                  style={{ paddingLeft: 38 }}
                  placeholder="Search user by full name or email address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="input-field"
                style={{ width: 140 }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="patient">Patient</option>
                <option value="consultant">Consultant</option>
                <option value="admin">Admin</option>
              </select>

              <select
                className="input-field"
                style={{ width: 160 }}
                value={pairingFilter}
                onChange={(e) => setPairingFilter(e.target.value)}
              >
                <option value="all">All Device States</option>
                <option value="paired">Device Paired</option>
                <option value="unpaired">Not Paired</option>
              </select>
            </div>

            {/* Users Table */}
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Device Status</th>
                    <th>Registered</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isEditing = editingUserId === user.id;
                    return (
                      <tr key={user.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 30, height: 30, borderRadius: "50%",
                                background:
                                  user.role === "admin"
                                    ? "linear-gradient(135deg, var(--violet), var(--rose))"
                                    : user.role === "consultant"
                                    ? "linear-gradient(135deg, var(--emerald), var(--blue))"
                                    : "linear-gradient(135deg, var(--cyan), var(--blue))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                              }}
                            >
                              {user.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{user.full_name}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>ID: #{user.id}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ fontSize: 12, fontFamily: "IBM Plex Mono", color: "var(--text-secondary)" }}>
                          {user.email}
                        </td>

                        <td>
                          {isEditing ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <select
                                className="input-field"
                                style={{ padding: "4px 8px", fontSize: 11, width: 120 }}
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                              >
                                <option value="patient">patient</option>
                                <option value="consultant">consultant</option>
                                <option value="admin">admin</option>
                              </select>
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => handleSaveRole(user.id)}
                                disabled={updatingUser}
                              >
                                {updatingUser ? "..." : "Save"}
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setEditingUserId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`badge ${
                                user.role === "admin"
                                  ? "badge-violet"
                                  : user.role === "consultant"
                                  ? "badge-blue"
                                  : "badge-live"
                              }`}
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setEditingUserId(user.id);
                                setSelectedRole(user.role);
                              }}
                              title="Click to edit role"
                            >
                              {user.role}
                            </span>
                          )}
                        </td>

                        <td>
                          {user.paired ? (
                            <span className="badge badge-teal" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Smartphone style={{ width: 10, height: 10 }} /> Paired
                            </span>
                          ) : (
                            <span className="badge badge-muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              Not Paired
                            </span>
                          )}
                        </td>

                        <td style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text-muted)" }}>
                          {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              if (isEditing) {
                                setEditingUserId(null);
                              } else {
                                setEditingUserId(user.id);
                                setSelectedRole(user.role);
                              }
                            }}
                          >
                            <UserCog style={{ width: 12, height: 12 }} /> Edit Role
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No users matched your current search filters.
                </div>
              )}
            </div>
          </div>

          {/* =========================================================================
              SECTION 3: FORUM MODERATION PANEL
             ========================================================================= */}
          <div className="card card-accent-rose" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert style={{ width: 18, height: 18, color: "var(--rose)" }} />
                <div>
                  <div className="section-title" style={{ marginBottom: 0 }}>Forum Moderation</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Review and moderate community forum posts flagged for policy violation</div>
                </div>
              </div>
              <span className={`badge ${flaggedPosts.length > 0 ? "badge-rose" : "badge-live"}`}>
                {flaggedPosts.length} Flagged {flaggedPosts.length === 1 ? "Post" : "Posts"}
              </span>
            </div>

            {flaggedPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)", background: "rgba(255,255,255,0.01)", borderRadius: 10, border: "1px dashed var(--bg-border)" }}>
                <ShieldCheck style={{ width: 28, height: 28, color: "var(--emerald)", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>No Flagged Content</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>All forum discussion threads are in good standing.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {flaggedPosts.map((post) => (
                  <div
                    key={post.id}
                    style={{
                      display: "flex", flexDirection: "column", gap: 8, padding: 14,
                      borderRadius: 10, background: "rgba(244, 63, 94, 0.05)",
                      border: "1px solid rgba(244, 63, 94, 0.2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{post.title}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", marginTop: 2 }}>
                          Author: <strong>{post.author_name}</strong> ({post.author_email}) · Posted {new Date(post.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleApprovePost(post.id)}
                          style={{ color: "var(--emerald)", borderColor: "var(--emerald)" }}
                        >
                          <Check style={{ width: 12, height: 12 }} /> Approve (Unflag)
                        </button>
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleRemovePost(post.id)}
                          style={{ color: "var(--rose)", borderColor: "var(--rose)" }}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} /> Remove Post
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, background: "var(--bg-elevated)", padding: 10, borderRadius: 6, border: "1px solid var(--bg-border)" }}>
                      {post.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* =========================================================================
              SECTION 4: MACHINE LEARNING MODEL STATUS PANEL
             ========================================================================= */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Cpu style={{ width: 16, height: 16, color: "var(--violet)" }} />
              <div className="section-title" style={{ marginBottom: 0 }}>Core AI Models & Pipeline Evaluation Status</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {MODEL_CONFIGS.map((model) => (
                <div
                  key={model.id}
                  className="card card-sm"
                  style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12, borderTop: `3px solid ${model.color}` }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {model.category}
                      </span>
                      <span className={`badge ${model.badgeClass}`}>{model.status}</span>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                      {model.name}
                    </div>

                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {model.description}
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-elevated)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bg-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>
                      {model.metricLabel}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: model.color, fontFamily: "IBM Plex Mono" }}>
                      {model.metricValue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
