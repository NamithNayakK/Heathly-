import { useLocation } from 'react-router-dom';
import { Bell, ChevronRight, Cpu, RefreshCw, Search } from 'lucide-react';

const BREADCRUMB_MAP = {
  '/dashboard': ['Platform', 'Dashboard'],
  '/assessment': ['Platform', 'Clinical Assessment'],
  '/chat': ['Platform', 'AI Companion'],
  '/health-report': ['Platform', 'Health Records'],
  '/results': ['Platform', 'Assessment Results'],
  '/forum': ['Platform', 'Community'],
};

export default function Topbar() {
  const location = useLocation();
  const crumbs = BREADCRUMB_MAP[location.pathname] || ['Platform'];

  return (
    <header className="app-topbar">
      {/* Breadcrumb */}
      <div className="topbar-breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <ChevronRight style={{ width: 13, height: 13, color: 'var(--text-muted)' }} />}
            <span className={i === crumbs.length - 1 ? 'topbar-breadcrumb-current' : ''}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* System Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
          <Cpu style={{ width: 12, height: 12, color: 'var(--emerald)' }} />
          <span>All systems operational</span>
          <span className="status-dot live" />
        </div>

        <div className="topbar-actions">
          <button className="topbar-icon-btn" title="Search">
            <Search style={{ width: 14, height: 14 }} />
          </button>
          <button className="topbar-icon-btn" title="Notifications">
            <Bell style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </header>
  );
}
