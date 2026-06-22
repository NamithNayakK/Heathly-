import { useEffect, useState } from "react";
import { ChevronRight, RefreshCw, Search, UserCog, Users } from "lucide-react";
import { api } from "../lib/api";

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingRole, setEditingRole] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      setEditingRole(null);
      load();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    patients: users.filter(u => u.role === 'patient').length,
    consultants: users.filter(u => u.role === 'consultant').length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">Manage all platform users, roles, and permissions</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw style={{ width: 13, height: 13, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ gap: 12 }}>
        {[
          { label: 'Total Users', value: stats.total, color: 'var(--cyan)' },
          { label: 'Patients', value: stats.patients, color: 'var(--emerald)' },
          { label: 'Consultants', value: stats.consultants, color: 'var(--blue)' },
          { label: 'Admins', value: stats.admins, color: 'var(--violet)' },
        ].map(s => (
          <div key={s.label} className="card card-sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: 'IBM Plex Sans' }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: 38 }} placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: 140 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="patient">Patients</option>
          <option value="consultant">Consultants</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: user.role === 'admin' ? 'linear-gradient(135deg, var(--violet), var(--rose))'
                          : user.role === 'consultant' ? 'linear-gradient(135deg, var(--emerald), var(--blue))'
                          : 'linear-gradient(135deg, var(--cyan), var(--blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {user.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{user.full_name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}>{user.email}</td>
                  <td>
                    {editingRole === user.id ? (
                      <select
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: 11, width: 120 }}
                        defaultValue={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        onBlur={() => setEditingRole(null)}
                        autoFocus
                      >
                        <option value="patient">Patient</option>
                        <option value="consultant">Consultant</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span
                        className={`badge ${user.role === 'admin' ? 'badge-violet' : user.role === 'consultant' ? 'badge-cyan' : 'badge-live'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setEditingRole(user.id)}
                        title="Click to change role"
                      >
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditingRole(editingRole === user.id ? null : user.id)}>
                      <UserCog style={{ width: 12, height: 12 }} /> Edit Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No users found.</div>
          )}
        </div>
      )}
    </div>
  );
}
