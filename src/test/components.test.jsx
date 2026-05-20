/**
 * Component interaction tests — rendering and button behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mock API client so components never hit the network ──────────────────────

vi.mock('../api/client', () => ({
  fetchKPI:                () => Promise.resolve({ totalRoutes: 232, totalStops: 9378, dailyRidership: 1240000, avgEquityScore: 62, disruptionIndex: 3.2, demandForecastAccuracy: 90 }),
  fetchTimeSeries:         () => Promise.resolve([{ hour: '08:00', actual: 5200, predicted: 5100 }, { hour: '17:00', actual: 8400, predicted: 8200 }]),
  fetchDemandByRoute:      () => Promise.resolve([{ route: 'Line 1', route_id: '1', demand: 182000, capacity: 200000, route_type: 1 }, { route: '501 Queen', route_id: '501', demand: 60000, capacity: 65000, route_type: 0 }]),
  fetchModelMetrics:       () => Promise.resolve({ r2: 0.976, mae: 210, mape: 8.2, accuracy_pct: 90, n_train: 74000, n_test: 13000, features: ['hour', 'day_of_week'], importances: { hour: 0.38, day_of_week: 0.22, route_type: 0.18, month: 0.12, temp_c: 0.10 } }),
  fetchEquityScores:       () => Promise.resolve([{ id: 'downtown', name: 'Downtown Core', lat: 43.65, lng: -79.38, equityScore: 89, income_index: 1.0, senior_pct: 8, disability_pct: 6, stopDensity: 9.2, routeCount: 12, population: 55000, vulnerability: 0.1, stopCount: 32 }]),
  fetchEquityRoutes:       () => Promise.resolve([{ id: '1', name: 'Line 1 – Yonge-University', score: 72, route_type: 1 }]),
  fetchGapZones:           () => Promise.resolve([{ id: 1, name: 'Malvern North', lat: 43.81, lng: -79.22, gapScore: 88, population: 18400, stopDensity: 0.6, estimatedBenefit: 3200, costEstimateK: 208, roiScore: 15.38, proposedStop: { lat: 43.81, lng: -79.22, name: 'Proposed: Malvern North Transit Hub' } }]),
  fetchDisruptionStations: () => Promise.resolve([{ stop_id: 'bloor', stop_name: 'Bloor-Yonge', lat: 43.67, lng: -79.38, routes: ['Line 1 – Yonge-University'] }]),
  fetchDisruptionSimulation: () => Promise.resolve({ stop_id: 'bloor', stop_name: 'Bloor-Yonge', affected_routes: [{ route_id: '1', route_name: 'Line 1' }], alternatives: [{ rank: 1, route_id: '501', route: '501 — Queen', eta_min: 10, eta: '+10 min', reliability: 'High' }], cascade: [{ for_route: '501 — Queen', alternatives: [{ rank: 1, route: '506 — Carlton', eta: '+15 min', reliability: 'Medium' }] }], recovery_time: '22 min', impacted_riders: 4200 }),
  fetchHeatmap:            () => Promise.resolve([{ station: 'Union', mon: 9800, tue: 9500, wed: 9700, thu: 9600, fri: 10200, sat: 6800, sun: 5200 }]),
  fetchCoverageStats:      () => Promise.resolve({ before: { population_covered_pct: 71.2, avg_walk_to_stop_min: 12.4, stops_per_km2: 3.1 }, after: { population_covered_pct: 82.7, avg_walk_to_stop_min: 8.2, stops_per_km2: 3.9 } }),
}));

// ─── ServiceGap ───────────────────────────────────────────────────────────────

import ServiceGap from '../modules/ServiceGap';

describe('ServiceGap', () => {
  it('renders without crashing', async () => {
    render(<ServiceGap />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows "Current Gaps" and "With Proposals" toggle buttons', async () => {
    render(<ServiceGap />);
    await waitFor(() => expect(screen.getByText(/Current Gaps/i)).toBeInTheDocument());
    expect(screen.getByText(/With Proposals/i)).toBeInTheDocument();
  });

  it('"With Proposals" button toggles proposal overlay', async () => {
    const user = userEvent.setup();
    render(<ServiceGap />);
    await waitFor(() => screen.getByText(/With Proposals/i));
    await user.click(screen.getByText(/With Proposals/i));
    await waitFor(() => expect(screen.getByText(/Proposals active/i)).toBeInTheDocument());
  });

  it('"Current Gaps" button reverts overlay', async () => {
    const user = userEvent.setup();
    render(<ServiceGap />);
    await waitFor(() => screen.getByText(/With Proposals/i));
    await user.click(screen.getByText(/With Proposals/i));
    await user.click(screen.getByText(/Current Gaps/i));
    await waitFor(() => expect(screen.queryByText(/Proposals active/i)).not.toBeInTheDocument());
  });

  it('shows gap zone name in priority list', async () => {
    render(<ServiceGap />);
    await waitFor(() => expect(screen.getAllByText(/Malvern North/i).length).toBeGreaterThan(0));
  });

  it('shows ROI score in priority list', async () => {
    render(<ServiceGap />);
    await waitFor(() => expect(screen.getByText(/ROI/i)).toBeInTheDocument());
  });
});

// ─── DisruptionSim ────────────────────────────────────────────────────────────

import DisruptionSim from '../modules/DisruptionSim';

describe('DisruptionSim', () => {
  it('renders without crashing', async () => {
    render(<DisruptionSim />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows station count in KPI card', async () => {
    render(<DisruptionSim />);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('shows recovery time after map marker click', async () => {
    const user = userEvent.setup();
    render(<DisruptionSim />);
    await waitFor(() => screen.getByTestId('circle-marker'));
    await user.click(screen.getByTestId('circle-marker'));
    // "22 min" appears in both KPI card and scenario card — assert at least one instance
    await waitFor(() => expect(screen.getAllByText(/22 min/i).length).toBeGreaterThan(0), { timeout: 3000 });
  });

  it('shows cascade alternatives after simulation', async () => {
    const user = userEvent.setup();
    render(<DisruptionSim />);
    await waitFor(() => screen.getByTestId('circle-marker'));
    await user.click(screen.getByTestId('circle-marker'));
    // cascade renders the sub-alternative route name from mock data
    await waitFor(() => expect(screen.getByText(/506.*Carlton/i)).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows "Clear disruption" button when station is selected', async () => {
    const user = userEvent.setup();
    render(<DisruptionSim />);
    await waitFor(() => screen.getByTestId('circle-marker'));
    await user.click(screen.getByTestId('circle-marker'));
    await waitFor(() => expect(screen.getByText(/Clear disruption/i)).toBeInTheDocument(), { timeout: 3000 });
  });

  it('"Clear disruption" resets scenario', async () => {
    const user = userEvent.setup();
    render(<DisruptionSim />);
    await waitFor(() => screen.getByTestId('circle-marker'));
    await user.click(screen.getByTestId('circle-marker'));
    await waitFor(() => screen.getByText(/Clear disruption/i), { timeout: 3000 });
    await user.click(screen.getByText(/Clear disruption/i));
    await waitFor(() => expect(screen.queryByText(/Clear disruption/i)).not.toBeInTheDocument());
  });
});

// ─── RidershipDemand ─────────────────────────────────────────────────────────

import RidershipDemand from '../modules/RidershipDemand';

describe('RidershipDemand', () => {
  it('renders without crashing', async () => {
    render(<RidershipDemand />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows view tabs', async () => {
    render(<RidershipDemand />);
    await waitFor(() => {
      expect(screen.getByText('Time Series')).toBeInTheDocument();
      expect(screen.getByText('Station Heatmap')).toBeInTheDocument();
      expect(screen.getByText('Route Demand')).toBeInTheDocument();
    });
  });

  it('shows weather controls in Time Series view', async () => {
    render(<RidershipDemand />);
    await waitFor(() => expect(screen.getByText('Temp')).toBeInTheDocument());
    expect(screen.getByText('Rain')).toBeInTheDocument();
  });

  it('shows day-of-week buttons', async () => {
    render(<RidershipDemand />);
    await waitFor(() => expect(screen.getByText('Mon')).toBeInTheDocument());
    ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => {
      expect(screen.getByText(d)).toBeInTheDocument();
    });
  });

  it('switches to Station Heatmap tab', async () => {
    const user = userEvent.setup();
    render(<RidershipDemand />);
    await waitFor(() => screen.getByText('Station Heatmap'));
    await user.click(screen.getByText('Station Heatmap'));
    await waitFor(() => expect(screen.getByText('Union')).toBeInTheDocument());
  });

  it('shows feature importance from API (not hardcoded)', async () => {
    render(<RidershipDemand />);
    await waitFor(() => expect(screen.getByText('Feature Importance')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Hour of day')).toBeInTheDocument());
  });

  it('shows route type selector in Time Series view', async () => {
    render(<RidershipDemand />);
    await waitFor(() => expect(screen.getByText('Subway')).toBeInTheDocument());
    expect(screen.getByText('Streetcar')).toBeInTheDocument();
    expect(screen.getByText('Bus')).toBeInTheDocument();
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

import Dashboard from '../modules/Dashboard';

describe('Dashboard', () => {
  it('renders without crashing', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows KPI cards with real data', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('232')).toBeInTheDocument());
  });

  it('shows Data Sources panel', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Data Sources')).toBeInTheDocument());
    expect(screen.getByText('TTC GTFS Feed')).toBeInTheDocument();
    expect(screen.getByText(/Open Government Licence/i)).toBeInTheDocument();
  });

  it('shows System Alerts section', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('System Alerts')).toBeInTheDocument());
  });

  it('shows model metrics bar when data loads', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('XGBoost Model')).toBeInTheDocument());
  });
});
