import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { ErrorBoundary } from '../components/ErrorBoundary';

const getRouteTitle = (pathname: string): string => {
  if (pathname === '/' || pathname === '/dashboard') {
    return 'Operator Command Center';
  }
  if (pathname.startsWith('/incidents/')) {
    const id = pathname.split('/')[2];
    return `Incident #${id} Triage`;
  }
  if (pathname === '/incidents') {
    return 'Incident Management Queue';
  }
  if (pathname.startsWith('/cameras/')) {
    const id = pathname.split('/')[2];
    return `Sensor Inspector — ${id}`;
  }
  if (pathname === '/cameras') {
    return 'Surveillance Camera Fleet';
  }
  if (pathname === '/coverage') {
    return 'Perimeter Coverage & Blind-Spot Map';
  }
  if (pathname === '/settings') {
    return 'Platform Configuration & Telemetry';
  }
  return 'IBVAP Command Center';
};

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const currentTitle = getRouteTitle(location.pathname);

  return (
    <div className="app-container">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="main-wrapper">
        <Header
          title={currentTitle}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="content-area">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
