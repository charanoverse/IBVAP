import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { App } from '../src/App';

describe('IBVAP Operator Command Center UI & CCTV Ingestion (Phase 2)', () => {
  beforeEach(() => {
    cleanup();
    window.history.pushState({}, 'Test', '/');
  });

  it('1. Renders application shell, brand, operator info, and navigation links', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('IBVAP')).toBeDefined();
      expect(screen.getByText('Border Video Analytics')).toBeDefined();
      expect(screen.getByText('Demo Operator')).toBeDefined();
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByText('Incidents')).toBeDefined();
      expect(screen.getByText('Cameras')).toBeDefined();
      expect(screen.getByText('Coverage')).toBeDefined();
      expect(screen.getByText('Settings')).toBeDefined();
    });
  });

  it('2. Renders Dashboard with Operational KPIs, CCTV Replay Grid, Incident Queue, and System Health', async () => {
    render(<App />);
    await waitFor(() => {
      // KPI cards
      expect(screen.getByText('Cameras Fleet')).toBeDefined();
      expect(screen.getByText('Active Incidents')).toBeDefined();
      expect(screen.getByText('High Priority')).toBeDefined();
      expect(screen.getByText('Events Today')).toBeDefined();

      // Camera Matrix & Replay Tag
      expect(screen.getByText('Surveillance Camera Matrix')).toBeDefined();
      expect(screen.getByText('LOCAL CCTV REPLAY')).toBeDefined();

      // Incident Queue
      expect(screen.getByText('Active Incident Queue')).toBeDefined();

      // Subsystem Status
      expect(screen.getByText('Subsystem Status')).toBeDefined();
      expect(screen.getByText('AI Inference Engine')).toBeDefined();
    });
  });

  it('3. Navigates to Incidents page and verifies incident table', async () => {
    render(<App />);
    const incidentNav = screen.getByText('Incidents').closest('a') || screen.getByText('Incidents');
    fireEvent.click(incidentNav);

    await waitFor(() => {
      expect(screen.getByText('Perimeter Security Incidents & Triage Queue')).toBeDefined();
      expect(screen.getByText('ID')).toBeDefined();
      expect(screen.getByText('Incident Title')).toBeDefined();
      expect(screen.getByText('Review State')).toBeDefined();
    });
  });

  it('4. Navigates to Cameras page and verifies camera fleet table', async () => {
    render(<App />);
    const camerasNav = screen.getByText('Cameras').closest('a') || screen.getByText('Cameras');
    fireEvent.click(camerasNav);

    await waitFor(() => {
      expect(screen.getByText('Perimeter Surveillance Camera Fleet')).toBeDefined();
      expect(screen.getByText('North Gate — Main Entry View')).toBeDefined();
      expect(screen.getByText('Restricted Sterile Zone — Fence Line')).toBeDefined();
    });
  });

  it('5. Navigates to Coverage page and verifies 2D perimeter map', async () => {
    render(<App />);
    const coverageNav = screen.getByText('Coverage').closest('a') || screen.getByText('Coverage');
    fireEvent.click(coverageNav);

    await waitFor(() => {
      expect(screen.getByText('Perimeter Geospatial Coverage & Blind-Spot Analysis')).toBeDefined();
      expect(screen.getByText(/2D Perimeter Sensor Coverage/i)).toBeDefined();
      expect(screen.getByText('Perimeter Security Sectors & Sterile Zones')).toBeDefined();
    });
  });

  it('6. Navigates to Settings page and verifies system parameters and storage volumes', async () => {
    render(<App />);
    const settingsNav = screen.getByText('Settings').closest('a') || screen.getByText('Settings');
    fireEvent.click(settingsNav);

    await waitFor(() => {
      expect(screen.getByText('System Configuration & Telemetry Diagnostics')).toBeDefined();
      expect(screen.getByText('Core System Parameters')).toBeDefined();
      expect(screen.getByText('Storage & Data Volumes')).toBeDefined();
      expect(screen.getByText('LOCAL PROTOTYPE MODE')).toBeDefined();
    });
  });

  it('7. Navigates to Incident Queue on Dashboard and inspects quick filters', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Active Incident Queue')).toBeDefined();
      expect(screen.getByText('Active Incidents')).toBeDefined();
    });
  });

  it('8. Inspects Camera Detail page and verifies real CCTV video player and playback controls', async () => {
    render(<App />);
    const camerasNav = screen.getByText('Cameras').closest('a') || screen.getByText('Cameras');
    fireEvent.click(camerasNav);

    await waitFor(() => {
      expect(screen.getByText('North Gate — Main Entry View')).toBeDefined();
    });

    const camRow = screen.getByText('North Gate — Main Entry View');
    fireEvent.click(camRow);

    await waitFor(() => {
      expect(screen.getByText('CCTV Replay & Sensor Viewport')).toBeDefined();
      expect(screen.getByText('REAL LOCAL VIDEO')).toBeDefined();
      expect(screen.getByText('Geospatial & Sensor Specs')).toBeDefined();
      expect(screen.getByText('Hardware Capabilities')).toBeDefined();
      expect(screen.getByText('SNAPSHOT')).toBeDefined();
    });
  });
});
