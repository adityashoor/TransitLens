import { Locate, LocateFixed, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { useMap } from "react-leaflet";

// Renders inside MapContainer so it can use useMap()
export function MapActions() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const geolocate = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 1.2 });
        setLocating(false);
      },
      () => {
        // fallback: fly to TO city hall
        map.flyTo([43.6532, -79.3832], 13, { duration: 1.2 });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: "auto" }}>
      <div className="leaflet-control glass-card rounded-xl p-1 flex flex-col gap-1 mt-2 mr-2">
        <button
          onClick={() => map.zoomIn()}
          className="size-8 rounded-lg hover:bg-surface flex items-center justify-center"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="size-8 rounded-lg hover:bg-surface flex items-center justify-center"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={geolocate}
          className="size-8 rounded-lg hover:bg-surface flex items-center justify-center"
          aria-label="Locate me"
          disabled={locating}
        >
          {locating ? <LocateFixed className="size-4 text-primary animate-pulse" /> : <Locate className="size-4" />}
        </button>
      </div>
    </div>
  );
}
