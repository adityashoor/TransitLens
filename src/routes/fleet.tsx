import { createFileRoute } from "@tanstack/react-router";
import { Bus, Battery, Wrench, Accessibility } from "lucide-react";
import { useFleet } from "@/mock/api";
import { PageSkeleton } from "@/components/ui-ext/Skeleton";
import { PageError } from "@/components/ui-ext/QueryError";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { KpiCard } from "@/components/ui-ext/KpiCard";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/fleet")({
  head: () => ({ meta: [{ title: "Fleet Health — TransitLens" }] }),
  component: FleetPage,
});

const COLORS = ["var(--electric)", "var(--cyan)", "var(--teal)", "var(--warn)"];

function FleetPage() {
  const { data: fleet = [], isLoading, isError, refetch } = useFleet();
  if (isLoading) return <PageSkeleton />;
  if (isError && !fleet.length) return <PageError onRetry={refetch} />;
  const inService = fleet.filter((v) => v.status === "in-service").length;
  const charging = fleet.filter((v) => v.status === "charging").length;
  const accessible = Math.round((fleet.filter((v) => v.accessible).length / Math.max(1, fleet.length)) * 100);
  const avgHealth = Math.round(fleet.reduce((s, v) => s + v.health, 0) / Math.max(1, fleet.length));

  const byType = ["Bus", "Streetcar", "Subway", "eBus"].map((t) => ({
    name: t, count: fleet.filter((v) => v.type === t).length,
  }));

  const healthDist = [
    { name: "Excellent", value: fleet.filter((v) => v.health >= 85).length },
    { name: "Good", value: fleet.filter((v) => v.health >= 70 && v.health < 85).length },
    { name: "Fair", value: fleet.filter((v) => v.health >= 55 && v.health < 70).length },
    { name: "Needs service", value: fleet.filter((v) => v.health < 55).length },
  ];

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Fleet Health" subtitle="GTFS-RT in-service status · modeled roster health and maintenance estimates" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="In service" value={inService} format="raw" icon={Bus} accent="success" />
        <KpiCard label="Charging / Depot" value={charging} format="raw" icon={Battery} accent="cyan" />
        <KpiCard label="Avg health score" value={`${avgHealth}/100`} icon={Wrench} accent="primary" />
        <KpiCard label="Accessible fleet" value={`${accessible}%`} icon={Accessibility} accent="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="Fleet composition" subtitle="By vehicle type" className="h-[320px]">
          <ResponsiveContainer>
            <BarChart data={byType}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--electric)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Health distribution" subtitle="Modeled from roster template and live in-service status" className="h-[320px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={healthDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {healthDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Service flags" subtitle="Top vehicles needing attention" className="h-[320px]">
          <ul className="space-y-2 overflow-y-auto h-full pr-1 scrollbar-thin">
            {fleet.filter((v) => v.health < 70).slice(0, 8).map((v) => (
              <li key={v.id} className="rounded-xl border border-border bg-surface/40 p-2.5 flex items-center gap-3">
                <div className="text-xs font-mono">{v.id}</div>
                <div className="text-xs text-muted-foreground flex-1">{v.type} · {v.mileage.toLocaleString()} km</div>
                <div className="text-xs font-semibold text-warn">{v.health}/100</div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <ChartCard title="Vehicle roster" subtitle="Live vehicle IDs where available · remaining fields are modeled estimates">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {["ID","Type","Route","Mileage","Battery/Fuel","Health","Status","Next Service"].map(h => (
                  <th key={h} className="text-left font-medium py-2 px-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fleet.slice(0, 24).map((v) => (
                <tr key={v.id} className="border-b border-border/50 hover:bg-surface/40">
                  <td className="py-2 px-2 font-mono">{v.id}</td>
                  <td className="py-2 px-2">{v.type}</td>
                  <td className="py-2 px-2 text-muted-foreground">{v.routeId}</td>
                  <td className="py-2 px-2">{v.mileage.toLocaleString()} km</td>
                  <td className="py-2 px-2">{v.battery !== undefined ? `🔋 ${v.battery}%` : `⛽ ${v.fuel}%`}</td>
                  <td className="py-2 px-2">
                    <div className="w-20 h-1.5 rounded-full bg-surface overflow-hidden">
                      <div className="h-full" style={{ width: `${v.health}%`, background: v.health > 75 ? "var(--success)" : v.health > 55 ? "var(--warn)" : "var(--destructive)" }} />
                    </div>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{v.status}</td>
                  <td className="py-2 px-2 text-muted-foreground">{v.nextService}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
