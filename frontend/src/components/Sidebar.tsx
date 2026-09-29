import React from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggleCollapse }) => {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Main Navigation">
      <div className="sidebar-header">
        <div className="brand-wrapper">
          <div className="brand-icon" title="IBVAP">IB</div>
          {!collapsed && (
            <div className="brand-text">
              <span className="brand-title">IBVAP</span>
              <span className="brand-subtitle">Border Video Analytics</span>
            </div>
          )}
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="sidebar-toggle-btn"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle Sidebar"
          >
            {collapsed ? '›' : '‹'}
          </button>
        )}
      </div>

      <ul className="nav-links">
        <li className="nav-item">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'active' : '')}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
            </span>
            {!collapsed && <span className="nav-label">Dashboard</span>}
          </NavLink>
        </li>

        <li className="nav-item">
          <NavLink
            to="/incidents"
            className={({ isActive }) => (isActive ? 'active' : '')}
            title={collapsed ? 'Incidents' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </span>
            {!collapsed && (
              <>
                <span className="nav-label">Incidents</span>
                <span className="nav-pill" title="3 Active Incidents">3</span>
              </>
            )}
          </NavLink>
        </li>

        <li className="nav-item">
          <NavLink
            to="/cameras"
            className={({ isActive }) => (isActive ? 'active' : '')}
            title={collapsed ? 'Cameras' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" />
              </svg>
            </span>
            {!collapsed && (
              <>
                <span className="nav-label">Cameras</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>6</span>
              </>
            )}
          </NavLink>
        </li>

        <li className="nav-item">
          <NavLink
            to="/coverage"
            className={({ isActive }) => (isActive ? 'active' : '')}
            title={collapsed ? 'Coverage Map' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" x2="9" y1="3" y2="18" />
                <line x1="15" x2="15" y1="6" y2="21" />
              </svg>
            </span>
            {!collapsed && <span className="nav-label">Coverage</span>}
          </NavLink>
        </li>

        <li className="nav-item">
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'active' : '')}
            title={collapsed ? 'Settings' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            {!collapsed && <span className="nav-label">Settings</span>}
          </NavLink>
        </li>
      </ul>

      {!collapsed && (
        <div className="sidebar-footer">
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>IBVAP Command Center</div>
          <div style={{ color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>Phase 1 — Operator UI</div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>Local Prototype Mode</div>
        </div>
      )}
    </aside>
  );
};
