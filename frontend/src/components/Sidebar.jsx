import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart2, Bell, Brain, ChevronRight, ClipboardList,
  FileText, Home, Lock, LogOut, MessageSquare, Mic, Radio,
  Settings, Shield, Sliders, User, Users, Video, Zap
} from 'lucide-react';

const NAV = [
  {
    group: 'Core',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'Assessment', path: '/assessment', icon: ClipboardList },
      { label: 'AI Companion', path: '/chat', icon: MessageSquare },
      { label: 'Health Records', path: '/health-report', icon: FileText },
    ]
  },
  {
    group: 'Intelligence',
    items: [
      { label: 'Emotion Analytics', path: '/emotion-analytics', icon: Brain, soon: true },
      { label: 'Sensor Monitor', path: '/sensor', icon: Activity, soon: true },
      { label: 'Video Analysis', path: '/video', icon: Video, soon: true },
      { label: 'Behavioral Trends', path: '/trends', icon: BarChart2, soon: true },
    ]
  },
  {
    group: 'System',
    items: [
      { label: 'Bias Monitoring', path: '/bias', icon: Shield, soon: true },
      { label: 'Explainability', path: '/explainability', icon: Sliders, soon: true },
      { label: 'Audit Logs', path: '/audit', icon: Lock, soon: true },
      { label: 'Community', path: '/forum', icon: Users },
    ]
  },
  {
    group: 'Workspace',
    items: [
      { label: 'Results', path: '/results', icon: Zap },
      { label: 'Settings', path: '/settings', icon: Settings, soon: true },
      { label: 'Notifications', path: '/notifications', icon: Bell, soon: true },
    ]
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const userName = localStorage.getItem('full_name') || 'User';
  const userEmail = localStorage.getItem('email') || '';

  return (
    <aside className="app-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">H</div>
        <div>
          <div className="sidebar-logo-text">HEALTHLY</div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '1px' }}>
            Clinical AI Platform
          </div>
        </div>
      </div>

      {/* Nav Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {NAV.map(section => (
          <div key={section.group} className="sidebar-section">
            <div className="sidebar-section-label">{section.group}</div>
            {section.items.map(item => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  className={`sidebar-item ${active ? 'active' : ''}`}
                  style={{ width: '100%', background: 'none', border: '1px solid transparent', textAlign: 'left' }}
                  onClick={() => !item.soon && navigate(item.path)}
                  title={item.soon ? 'Coming soon' : item.label}
                >
                  <item.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.soon && (
                    <span style={{
                      fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                      background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                      fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em'
                    }}>SOON</span>
                  )}
                  {active && !item.soon && <span className="sidebar-indicator" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--bg-border)', padding: '12px 8px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px', borderRadius: 'var(--radius-md)',
          marginBottom: '4px'
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-item"
          style={{ width: '100%', color: '#F87171', background: 'none', border: '1px solid transparent' }}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
