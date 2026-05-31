import { MapContainer, TileLayer, Polyline, Tooltip } from "react-leaflet";
import { useNetwork } from "@/mock/api";
import { ClientOnly } from "@/components/ClientOnly";

const TO_CENTER: [number, number] = [43.718, -79.375];

// Subway line colours matching real TTC branding
const SUBWAY_COLORS: Record<string, string> = {
  "1": "#FFD700", // Line 1 Yonge-University — yellow
  "2": "#009E60", // Line 2 Bloor-Danforth — green
  "3": "#0060AC", // Line 3 Scarborough — blue
  "4": "#B40073", // Line 4 Sheppard — purple
};

function Map() {
  const { data: net } = useNetwork();

  const subway = (net?.routes ?? []).filter((r) => r.mode === "subway" && r.path.length >= 2);

  // Top 8 streetcar routes by ridership for secondary network skeleton
  const streetcar = (net?.routes ?? [])
    .filter((r) => r.mode === "streetcar" && r.path.length >= 2)
    .sort((a, b) => b.ridership - a.ridership)
    .slice(0, 8);

  // Top 6 high-ridership bus routes only (keeps preview uncluttered)
  const bus = (net?.routes ?? [])
    .filter((r) => r.mode === "bus" && r.path.length >= 2)
    .sort((a, b) => b.ridership - a.ridership)
    .slice(0, 6);

  return (
    <MapContainer
      center={TO_CENTER}
      zoom={10}
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      attributionControl={false}
      style={{ height: "100%", width: "100%", borderRadius: 12, background: "#0f1117" }}
    >
      <TileLayer
        url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
        attribution='© <a href="https://carto.com">CARTO</a>'
      />

      {/* Bus — faint grey skeleton */}
      {bus.map((r) => (
        <Polyline
          key={`bus-${r.id}`}
          positions={r.path}
          pathOptions={{ color: "#4b5563", weight: 1, opacity: 0.55 }}
        />
      ))}

      {/* Streetcar — soft red, medium weight */}
      {streetcar.map((r) => (
        <Polyline
          key={`str-${r.id}`}
          positions={r.path}
          pathOptions={{ color: "#f87171", weight: 1.5, opacity: 0.7 }}
        >
          <Tooltip sticky>
            <span style={{ fontSize: 11 }}>{r.shortName} · {r.longName}</span>
          </Tooltip>
        </Polyline>
      ))}

      {/* Subway — bright branded colours, prominent weight */}
      {subway.map((r) => (
        <Polyline
          key={`sub-${r.id}`}
          positions={r.path}
          pathOptions={{
            color: SUBWAY_COLORS[r.id] ?? r.color ?? "#FFD700",
            weight: 3.5,
            opacity: 0.95,
          }}
        >
          <Tooltip sticky>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{r.shortName} · {r.longName}</span>
          </Tooltip>
        </Polyline>
      ))}
    </MapContainer>
  );
}

export function MiniNetworkMap() {
  return (
    <ClientOnly
      fallback={
        <div className="size-full rounded-xl bg-surface/40 grid place-items-center text-xs text-muted-foreground">
          Loading map…
        </div>
      }
    >
      <Map />
    </ClientOnly>
  );
}
