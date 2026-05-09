import { motion } from "framer-motion";
import { Bus, X } from "lucide-react";
import type { Route as TransitRoute } from "@/mock/routes";
import { seeded } from "@/lib/format";
import { useNetwork } from "@/mock/api";

export interface StopMeta {
  id: string;
  routeId: string;
  name: string;
  pos: [number, number];
}

export function StopArrivalsPanel({ stop, onClose }: { stop: StopMeta; onClose: () => void }) {
  const { data: net } = useNetwork();
  const route = net?.routes.find((r) => r.id === stop.routeId);
  const rng = seeded(stop.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const arrivals = Array.from({ length: 4 }, (_, i) => {
    const eta = Math.round((i * 4 + rng() * 6) + 1);
    const delay = Math.round((rng() - 0.6) * 5);
    return {
      headsign: route?.longName.split(" - ")[0] ?? "Outbound",
      eta,
      delay,
      occupancy: Math.round(rng() * 100),
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute bottom-28 md:bottom-28 left-4 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 z-[1100] glass-card rounded-2xl p-4 w-auto md:w-[420px]"
      role="dialog"
      aria-label={`Arrivals at ${stop.name}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="size-9 rounded-xl text-xs font-bold flex items-center justify-center text-primary-foreground shrink-0"
          style={{ background: route?.color ?? "var(--primary)" }}
        >
          {route?.shortName ?? "—"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{stop.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {route?.longName} · stop #{stop.id.slice(-4)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface flex items-center justify-center"
          aria-label="Close arrivals"
        >
          <X className="size-4" />
        </button>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {arrivals.map((a, i) => (
          <li key={i} className="py-2 flex items-center gap-3">
            <Bus className="size-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.headsign}</div>
              <div className="text-[11px] text-muted-foreground">
                {a.delay > 0 ? `${a.delay} min late` : a.delay < 0 ? `${Math.abs(a.delay)} min early` : "On time"}
                {" · "}
                {a.occupancy < 40 ? "Light" : a.occupancy < 75 ? "Moderate" : "Crowded"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold tabular-nums">{a.eta}</div>
              <div className="text-[10px] text-muted-foreground">min</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[10px] text-muted-foreground">Mock data — wire to TTC NextBus / GTFS-RT later.</div>
    </motion.div>
  );
}
