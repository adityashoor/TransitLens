import {
  MapContainer, TileLayer, Polyline, CircleMarker,
  Tooltip, Polygon, useMap, useMapEvents,
} from "react-leaflet";
import { useEffect, useState, useMemo } from "react";
import type { Route, LatLng } from "@/mock/routes";
import { useNetwork, useVehicles, useHoods } from "@/mock/api";
import type { Hood } from "@/mock/data";
import { useUI } from "@/store/ui";
import { MapActions } from "./MapActions";
import type { StopMeta } from "./StopArrivalsPanel";
import { useBunching } from "@/hooks/useBunching";

const TO_CENTER: [number, number] = [43.718, -79.375];

// Reliable CartoDB dark tile — classic CDN, widely cached, no CORS issues
const DARK_TILE = "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png";
const ATTRIBUTION = '© <a href="https://carto.com">CARTO</a> © <a href="https://openstreetmap.org/copyright">OSM</a>';

function colorForScore(v: number) {
  if (v >= 80) return "#22d3ee";
  if (v >= 65) return "#14b8a6";
  if (v >= 50) return "#f1c232";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}

/** Tracks map zoom level and exposes it to parent */
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoom: () => onZoom(map.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}

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
  onHoodClick?: (h: Hood) => void;
  disabledRouteIds?: Set<string>;
  zoom?: number;
  className?: string;
  withActions?: boolean;
  showBunching?: boolean;
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
  zoom = 12,
  className,
  withActions = false,
  showBunching = true,
}: TransitMapProps) {
  const { data: net } = useNetwork();
  const { vehicles = [] } = useVehicles();
  const { mapLayers, timeOffset } = useUI();
  const bunchPairs = useBunching();
  const [mapZoom, setMapZoom] = useState(zoom);

  // Deterministic hash so same vehicle always maps to same base path index
  const hashId = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    return h;
  };

  // Time-travel: shift vehicles deterministically along their route path
  // timeOffset is in minutes (0 = live, -60 = 60 min ago)
  const shiftedVehicles = useMemo(() => {
    if (timeOffset === 0) return vehicles;
    return vehicles.map((v) => {
      const r = net?.routes.find((x) => x.id === v.routeId);
      if (!r || r.path.length < 2) return v;
      // Each vehicle gets a deterministic base position (no random)
      const base = hashId(v.id) % r.path.length;
      // Shift backward along path proportional to timeOffset
      // -60min = move back ~30% of route length
      const pctBack = Math.abs(timeOffset) / 60;
      const stepsBack = Math.round(pctBack * r.path.length * 0.4);
      const idx = Math.max(0, Math.min(r.path.length - 1, base - stepsBack));
      return { ...v, pos: r.path[idx] as LatLng };
    });
  }, [vehicles, net, timeOffset]);

  // Render order: bus (back) → streetcar → subway (front)
  const orderedRoutes = useMemo(() =>
    [...(net?.routes ?? [])].sort((a, b) => {
      const w = { bus: 0, streetcar: 1, subway: 2 } as Record<string, number>;
      return (w[a.mode] ?? 0) - (w[b.mode] ?? 0);
    }),
  [net?.routes]);

  // Real stops — Toronto bounds only, capped for performance
  const realStops = useMemo(() =>
    (net?.stops ?? [])
      .filter((s) => s.pos[0] > 43.5 && s.pos[0] < 44.0 && s.pos[1] > -79.7 && s.pos[1] < -79.1)
      .slice(0, 500),
  [net?.stops]);

  // Only show stops when zoomed in — at city scale they're visual noise
  const showStopDots = showStops && mapLayers.stops && mapZoom >= 13 && realStops.length > 0;

  const inferStopRouteId = (stopPos: LatLng) => {
    const candidate = orderedRoutes.find((route) =>
      route.path.some((p, i) =>
        i % 5 === 0 &&
        Math.abs(p[0] - stopPos[0]) < 0.003 &&
        Math.abs(p[1] - stopPos[1]) < 0.003,
      ),
    );
    return candidate?.id ?? "";
  };

  return (
    <div className={className} style={{ height, width: "100%", borderRadius: 16, overflow: "hidden" }}>
      <MapContainer
        center={TO_CENTER}
        zoom={zoom}
        zoomControl={!withActions}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", background: "#111827" }}
      >
        <TileLayer url={DARK_TILE} attribution={ATTRIBUTION} />
        <ZoomWatcher onZoom={setMapZoom} />
        {withActions && <MapActions />}

        {/* Equity neighbourhood polygons */}
        {hoods?.map((h) => (
          <Polygon
            key={h.id}
            positions={h.polygon}
            pathOptions={{
              color: colorForScore(h.mobilityScore),
              fillColor: colorForScore(h.mobilityScore),
              fillOpacity: 0.4, weight: 1,
            }}
            eventHandlers={{ click: () => onHoodClick?.(h) }}
          >
            <Tooltip>
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{h.name}</div>
                <div>Mobility: {h.mobilityScore}/100</div>
                <div>Avg wait: {h.avgWait} min</div>
              </div>
            </Tooltip>
          </Polygon>
        ))}

        {/* Route polylines — ordered bus → streetcar → subway */}
        {mapLayers.routes && orderedRoutes.map((r) => {
          const isHi = highlightRouteId === r.id;
          const dim  = !!(highlightRouteId && !isHi);
          const disabled = !!(disabledRouteIds?.has(r.id));

          // Mode-differentiated visual weight
          const weight  = disabled ? 2
            : r.mode === "subway"    ? (isHi ? 8 : 5)
            : r.mode === "streetcar" ? (isHi ? 4 : 2.5)
            : isHi ? 3 : 1.2;

          const opacity = disabled ? 0.85
            : dim        ? 0.08
            : r.mode === "subway"    ? 0.95
            : r.mode === "streetcar" ? 0.75
            : 0.40;   // bus routes very faint — city grid skeleton only

          // Bus routes rendered in neutral grey to avoid red overload
          const color = disabled ? "#ef4444"
            : r.mode === "bus" && !isHi ? "#6b7280"
            : r.color;

          return (
            <Polyline
              key={r.id}
              positions={r.path}
              pathOptions={{
                color,
                weight,
                opacity,
                dashArray: disabled ? "8 5" : undefined,
                lineCap: "round",
                lineJoin: "round",
              }}
              eventHandlers={{ click: () => onRouteClick?.(r) }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 700 }}>{r.shortName} · {r.longName}</div>
                  <div style={{ color: "#94a3b8", marginTop: 2 }}>
                    {r.mode} · {r.onTime}% on time · {r.headway} min headway
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Real stops — only when zoomed in close enough */}
        {showStopDots && realStops.map((s) => (
          <CircleMarker
            key={s.id}
            center={s.pos}
            radius={3}
            pathOptions={{
              color: "#475569",
              fillColor: "#cbd5e1",
              fillOpacity: 0.85,
              weight: 1,
            }}
            eventHandlers={{
              click: () => onStopClick?.({
                id: s.id, routeId: s.routeIds[0] ?? inferStopRouteId(s.pos), name: s.name, pos: s.pos,
              }),
            }}
          >
            <Tooltip><span style={{ fontSize: 11 }}>{s.name}</span></Tooltip>
          </CircleMarker>
        ))}

        {/* Hint when stops are hidden */}
        {showStops && mapLayers.stops && mapZoom < 14 && (
          <>{/* Zoom in to see stops — handled by LayerControls hint */}</>
        )}

        {/* Live vehicles */}
        {mapLayers.vehicles && showVehicles && shiftedVehicles.map((v) => {
          const r = net?.routes.find((x) => x.id === v.routeId);
          const isLate = v.delay > 0;
          const radius = r?.mode === "subway" ? 7 : r?.mode === "streetcar" ? 6 : 5;
          const fillColor = isLate ? "#f97316" : (r?.color ?? "#22d3ee");
          return (
            <CircleMarker
              key={v.id}
              center={v.pos}
              radius={radius}
              pathOptions={{
                color: "#ffffff",
                fillColor,
                fillOpacity: 1,
                weight: 1.5,
              }}
            >
              <Tooltip>
                <div style={{ fontSize: 11 }}>
                  <div style={{ fontWeight: 700 }}>
                    {r ? `${r.shortName} · ${r.longName}` : `Route ${v.routeId}`}
                  </div>
                  <div style={{ color: isLate ? "#f97316" : "#22d3ee", marginTop: 2 }}>
                    {isLate ? `⚠ +${v.delay} min late` : "✓ On time"}
                  </div>
                  <div style={{ color: "#94a3b8" }}>Occupancy {v.occupancy}%</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Bunching detection — can be disabled on simulator page */}
        {mapLayers.vehicles && showBunching && bunchPairs.map((bp) => (
          <CircleMarker
            key={`bunch-${bp.v1Id}-${bp.v2Id}`}
            center={bp.pos}
            radius={16}
            pathOptions={{
              color: "#f97316",
              fillColor: "#f97316",
              fillOpacity: 0.15,
              weight: 2.5,
            }}
          >
            <Tooltip>
              <div style={{ fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: "#f97316" }}>⚠ Bus Bunching Detected</div>
                <div>Route {bp.routeId}</div>
                <div>{bp.distanceM} m gap</div>
                <div style={{ color: "#94a3b8", marginTop: 2 }}>Alert OCC to restore headway</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export function HoodsMap({ onHoodClick }: { onHoodClick?: (h: Hood) => void }) {
  const { data: hoods = [] } = useHoods();
  return (
    <TransitMap
      hoods={hoods}
      onHoodClick={onHoodClick}
      showStops={false}
      showVehicles={false}
      zoom={11}
    />
  );
}
