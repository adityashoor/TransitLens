import { useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as MapTooltip, Polyline } from "react-leaflet";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, formatNumber } from "../services/api";
import { useApi } from "../hooks/useApi";
import { Badge, Card, CardHeader, Field, Icon, KPI, PageHeader, Skeleton } from "../components/ui";
import { chartTooltip } from "../components/chartConfig";

const TORONTO = [43.6532, -79.3832];

const routeTypeLabel = {
  0: "Streetcar",
  1: "Subway",
  2: "Rail",
  3: "Bus",
};

const typeColor = {
  0: "#d946ef",
  1: "#2563eb",
  2: "#0891b2",
  3: "#16a34a",
};

function routeLabel(route) {
  if (!route) return "Select route";
  return `${route.route_short_name || route.route_id} - ${route.route_long_name || "TTC route"}`;
}

function serviceMetrics(route, stops) {
  const stopCount = stops?.length || 0;
  const shapePoints = route?.shape?.length || 0;
  return [
    { label: "Nearby Stops", value: formatNumber(stopCount), tone: "green" },
    { label: "Shape Points", value: formatNumber(shapePoints), tone: "blue" },
    { label: "Route Type", value: routeTypeLabel[route?.route_type] || "TTC", tone: "purple" },
  ];
}

export default function ServiceGap() {
  const [selectedRouteId, setSelectedRouteId] = useState("504");
  const [center, setCenter] = useState(TORONTO);
  const [layers, setLayers] = useState({ route: true, stops: true });

  const routes = useApi(api.routes, []);
  const routeDetail = useApi(() => api.route(selectedRouteId), [selectedRouteId]);
  const nearbyStops = useApi(() => api.stopsNear({ lat: center[0], lon: center[1], radius: 1800, limit: 140 }), [center]);

  const routeOptions = useMemo(() => {
    const list = routes.data || [];
    return [...list]
      .sort((a, b) => String(a.route_short_name || a.route_id).localeCompare(String(b.route_short_name || b.route_id), undefined, { numeric: true }))
      .slice(0, 220);
  }, [routes.data]);

  const selectedRoute = routeDetail.data;
  const shape = selectedRoute?.shape || [];
  const routeColor = typeColor[selectedRoute?.route_type] || "#2563eb";
  const metrics = serviceMetrics(selectedRoute, nearbyStops.data);

  const stopDensityData = useMemo(() => {
    const stops = nearbyStops.data || [];
    const buckets = stops.reduce((acc, stop) => {
      const key = stop.zone_id || "unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(buckets)
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [nearbyStops.data]);

  const onRouteChange = (value) => {
    setSelectedRouteId(value);
  };

  return (
    <section aria-label="Network map">
      <PageHeader
        eyebrow="Live GTFS network"
        title="Network Map"
        subtitle="Inspect TTC routes, geometry, and nearby stop coverage directly from the PostGIS-backed API."
        action={<Badge color={routes.error ? "red" : "green"}>{routes.error ? "API issue" : "Live feed"}</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title={routeLabel(selectedRoute)}
            subtitle="Route geometry and nearby stops"
            action={
              <div className="flex items-center gap-2">
                <button
                  className={`button-ghost ${layers.route ? "text-slate-950" : "text-slate-400"}`}
                  onClick={() => setLayers((value) => ({ ...value, route: !value.route }))}
                  type="button"
                >
                  <Icon name="route" size={16} />
                  Route
                </button>
                <button
                  className={`button-ghost ${layers.stops ? "text-slate-950" : "text-slate-400"}`}
                  onClick={() => setLayers((value) => ({ ...value, stops: !value.stops }))}
                  type="button"
                >
                  <Icon name="map-pin" size={16} />
                  Stops
                </button>
              </div>
            }
          />

          <div className="map-frame">
            <MapContainer center={TORONTO} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {layers.route && shape.length > 1 && (
                <Polyline positions={shape} pathOptions={{ color: routeColor, weight: 5, opacity: 0.88, lineCap: "round" }}>
                  <Popup>
                    <strong>{routeLabel(selectedRoute)}</strong>
                    <br />
                    {shape.length.toLocaleString()} shape points
                  </Popup>
                </Polyline>
              )}

              {layers.stops &&
                (nearbyStops.data || []).map((stop) => (
                  <CircleMarker
                    key={stop.stop_id}
                    center={[stop.stop_lat, stop.stop_lon]}
                    radius={5}
                    pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0f172a", fillOpacity: 0.9 }}
                    eventHandlers={{ click: () => setCenter([stop.stop_lat, stop.stop_lon]) }}
                  >
                    <MapTooltip direction="top" offset={[0, -6]} opacity={0.96}>
                      <strong>{stop.stop_name}</strong>
                      <br />
                      {stop.stop_id}
                    </MapTooltip>
                    <Popup>
                      <strong>{stop.stop_name}</strong>
                      <br />
                      Stop {stop.stop_id}
                    </Popup>
                  </CircleMarker>
                ))}
            </MapContainer>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Controls" subtitle="Route and coverage radius" />
            <div className="space-y-4 p-5">
              <Field label="TTC route">
                <select className="select" value={selectedRouteId} onChange={(event) => onRouteChange(event.target.value)}>
                  {routeOptions.map((route) => (
                    <option key={route.route_id} value={route.route_id}>
                      {routeLabel(route)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
                  <KPI key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
                ))}
                <KPI label="Map Center" value={`${center[0].toFixed(3)}, ${center[1].toFixed(3)}`} tone="slate" />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Stop Density" subtitle="Nearby stops grouped by GTFS zone" />
            <div className="h-56 p-4 pt-0">
              {nearbyStops.loading ? (
                <Skeleton className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stopDensityData} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="zone" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Nearest Stops" subtitle="Click a row to recenter the coverage query" />
            <div className="max-h-[360px] overflow-auto">
              {(nearbyStops.data || []).slice(0, 14).map((stop, index) => (
                <button
                  key={stop.stop_id}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-5 py-3 text-left transition hover:bg-slate-50"
                  type="button"
                  onClick={() => setCenter([stop.stop_lat, stop.stop_lon])}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{stop.stop_name}</span>
                    <span className="block text-xs text-slate-500">Stop {stop.stop_id}</span>
                  </span>
                  <Icon name="map-pin" size={16} className="text-slate-400" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
