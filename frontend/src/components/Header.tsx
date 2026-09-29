import React, { useState, useEffect } from 'react';
import { useHealth } from '../hooks/useHealth';
import { StatusBadge } from './StatusBadge';

interface HeaderProps {
  title?: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { health, loading, error } = useHealth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format: HH:MM:SS
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);

      // Format: DD MMM YYYY
      const day = String(now.getDate()).padStart(2, '0');
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      setCurrentDate(`${day} ${month} ${year}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="top-header">
      <div className="header-left">
        <h1 className="header-page-title">{title || 'Command Center'}</h1>
        <span className="demo-tag">PROTOTYPE PHASE 1</span>
      </div>

      <div className="header-right">
        {/* Real Backend API Health Connectivity Indicator */}
        <div className="header-status-item" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            API Core:
          </span>
          {loading ? (
            <StatusBadge status="loading" label="CONNECTING..." />
          ) : error ? (
            <StatusBadge status="error" label="OFFLINE" />
          ) : (
            <StatusBadge status="ok" label={`ONLINE (${health?.service || 'ibvap-backend'})`} />
          )}
        </div>

        {/* Live Operational Clock & Date */}
        <div className="header-telemetry-box">
          <span className="header-clock" title="Live Operation Time">{currentTime || '10:42:18'}</span>
          <span className="header-date">{currentDate || '26 SEP 2026'}</span>
        </div>

        {/* Operator Badge */}
        <div className="header-operator-badge">
          <div className="operator-avatar" title="Authenticated Operator">OP</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              Demo Operator
            </span>
            <span style={{ fontSize: '0.65rem', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
              TAC-LEVEL 2
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
