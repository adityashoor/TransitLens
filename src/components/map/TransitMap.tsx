import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Polygon, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Route, LatLng } from "@/mock/routes";
import { useNetwork, useVehicles, useHoods } from "@/mock/api";
import type { Hood } from "@/mock/data";
import { useUI } from "@/store/ui";
import { MapActions } from "./MapActions";
import type { StopMeta } from "./StopArrivalsPanel";

const TO_CENTER: [number, number] = [43.7, -79.4];

function FitBounds({ pts }: { pts: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length) map.fitBounds(pts as [number, number][], { padding: [40, 40] });
  }, [map, pts]);
  return null;
}

interface TransitMapProps {
  height?: string | number;
  showVehicles?: boolean;
  showStops?: boolean;
  highlightRouteId?: string | null;
  onRouteClick?: (r: Route) => void;
  onStopClick?: (s: StopMeta) => void;
  hoods?: Hood[];
  hoodValueKey?: keyof Hood;
  onHoodClick?: (h: Hood) => void;
  disabledRouteIds?: Set<string>;
  zoom?: number;
  className?: string;
  withActions?: boolean;
}

function colorForScore(v: number) {
  if (v >= 80) return "#22d3ee";
  if (v >= 65) return "#14b8a6";
  if (v >= 50) return "#f1c232";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}

export function TransitMap({
  height = "100%",
  showVehicles = true,
  showStops = true,
  highlightRouteId = null,
  onRouteClick,
  onStopClick,
  hoods,
  onHoodClick,
  disabledRouteIds,
  zoom = 11,
  className,
  withActions = false,
}: TransitMapProps) {
  const { data: net } = useNetwork();
  const { data: vehicles = [] } = useVehicles();
  const { mapLayers, timeOffset } = useUI();

  // Time-travel: shift vehicles backwards along their route paths
  const shift = timeOffset / 60; // -1..0
  const shiftedVehicles = vehicles.map((v) => {
    if (shift === 0) return v;
    const r = net?.routes.find((x) => x.id === v.routeId);
    if (!r) return v;
    const idx = Math.max(0, Math.min(r.path.length - 2, Math.floor(Math.random() * r.path.length) + Math.round(shift * 4)));
    const a = r.path[Math.max(0, idx)];
    return { ...v, pos: a as LatLng };
  });

  return (
    <div className={className} style={{ height, width: "100%", borderRadius: 16, overflow: "hidden" }}>
      <MapContainer
        center={TO_CENTER}
        zoom={zoom}
        zoomControl={!withActions}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", background: "var(--background)" }}
      >
        <TileLayer
          attribution='© OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withActions && <MapActions />}

        {hoods?.map((h) => (
          <Polygon
            key={h.id}
            positions={h.polygon}
            pathOptions={{
              color: colorForScore(h.mobilityScore),
              fillColor: colorForScore(h.mobilityScore),
              fillOpacity: 0.45,
              weight: 1,
            }}
            eventHandlers={{ click: () => onHoodClick?.(h) }}
          >
            <Tooltip>
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{h.name}</div>
                <div>Mobility: {h.mobilityScore}</div>
                <div>Stops/km²: {h.stopDensity}</div>
                <div>Avg wait: {h.avgWait} min</div>
              </div>
            </Tooltip>
          </Polygon>
        ))}

        {mapLayers.routes && net?.routes.map((r) => {
          const isHi = highlightRouteId === r.id;
          const dim = highlightRouteId && !isHi;
          const disabled = disabledRouteIds?.has(r.id);
          return (
            <Polyline
              key={r.id}
              positions={r.path}
              pathOptions={{
                color: disabled ? "#ef4444" : r.color,
                weight: r.mode === "subway" ? (isHi ? 7 : 5) : isHi ? 5 : 3,
                opacity: disabled ? 0.9 : dim ? 0.25 : 0.85,
                dashArray: disabled ? "8 6" : undefined,
              }}
              eventHandlers={{ click: () => onRouteClick?.(r) }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{r.shortName} · {r.longName}</div>
                  <div>{r.mode} · {r.onTime}% on time</div>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {mapLayers.stops && showStops && net?.routes.flatMap((r) =>
          r.path.filter((_, i) => i % 3 === 0).map((p, i) => {
            const stopId = `${r.id}-s${i}`;
            return (
              <CircleMarker
                key={stopId}
                center={p}
                radius={3.5}
                pathOptions={{ color: r.color, fillColor: "#fff", fillOpacity: 0.9, weight: 1.5 }}
                eventHandlers={{
                  click: () =>
                    onStopClick?.({
                      id: stopId,
                      routeId: r.id,
                      name: `${r.shortName} · Stop ${i + 1}`,
                      pos: p as [number, number],
                    }),
                }}
              >
                <Tooltip>{`${r.shortName} · Stop ${i + 1}`}</Tooltip>
              </CircleMarker>
            );
          }))}

        {mapLayers.vehicles && showVehicles && shiftedVehicles.map((v) => {
          const r = net?.routes.find((x) => x.id === v.routeId);
          return (
            <CircleMarker
              key={v.id}
              center={v.pos}
              radius={4}
              pathOptions={{
                color: r?.color ?? "#22d3ee",
                fillColor: r?.color ?? "#22d3ee",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip>
                <div style={{ fontSize: 11 }}>
                  <div>{r?.shortName} · vehicle {v.id}</div>
                  <div>{v.delay > 0 ? `+${v.delay}m late` : "On time"}</div>
                  <div>Occupancy {v.occupancy}%</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export function HoodsMap({ onHoodClick }: { onHoodClick?: (h: Hood) => void }) {
  const { data: hoods = [] } = useHoods();
  return <TransitMap hoods={hoods} onHoodClick={onHoodClick} showStops={false} showVehicles={false} />;
}
