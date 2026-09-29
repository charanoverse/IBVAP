import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#f87171' }}>404 — Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        The requested screen does not exist in the IBVAP interface.
      </p>
      <Link
        to="/dashboard"
        style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: '#fff',
          borderRadius: '4px',
          fontWeight: 500,
        }}
      >
        Return to Dashboard
      </Link>
    </div>
  );
};
