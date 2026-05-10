# Phase 7 Disruption Simulation

This module builds a GTFS-derived directed transit graph and uses it to simulate route delays, line closures, and station closures.

## Graph Model

- Nodes: TTC GTFS stops.
- Transit edges: consecutive stops from representative route, direction, and shape patterns.
- Edge weights: average travel time in seconds from GTFS stop times.
- Transfer edges: walking links between nearby stops.
- Baseline OD paths: precomputed shortest paths among high-traffic stops.

Tables:

- `transit_graph_edges`
- `transit_graph_builds`
- `baseline_od_paths`

## Build

```powershell
.\backend\scripts\build_transit_graph.ps1
.\backend\scripts\validate_transit_graph.ps1
```

Tunable build options:

```powershell
.\backend\scripts\build_transit_graph.ps1 -TransferRadiusM 150 -WalkingMps 1.3 -OdLimit 25
```

## API

```text
POST /simulate-disruption
```

Example:

```json
{
  "type": "route_delay",
  "affected_ids": ["504"],
  "start_time": "2026-05-10T08:00:00",
  "end_time": "2026-05-10T10:00:00",
  "delay_minutes": 12
}
```

Response fields include:

- `affected_trip_count`
- `affected_routes`
- `affected_stops`
- `average_delay_minutes`
- `passenger_impact_minutes`
- `alternatives`
- `impact_summary`

Each alternative contains origin, destination, baseline time, new time, delay, route path, and stop path.

## Current Performance Choice

The full TTC `stop_times` table has more than 4.2 million rows. To keep local graph builds practical, transit edges are generated from representative route, direction, and shape patterns instead of every trip instance. This preserves network topology for planning simulation while avoiding very long graph builds on a laptop.

## Limitations

- Passenger impact is estimated from surface route daily ridership and the requested disruption window.
- Live vehicle positions and real-time service alerts are not included.
- OD sampling is intentionally limited for interactive API latency.
