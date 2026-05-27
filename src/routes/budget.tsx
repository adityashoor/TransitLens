import { createFileRoute } from "@tanstack/react-router";
import { Wallet, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { useBudget } from "../mock/api";
import { ChartCard, PageHeader } from "../components/ui-ext/ChartCard";
import { KpiCard } from "../components/ui-ext/KpiCard";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ZAxis,
} from "recharts";

export const Route = createFileRoute("/budget")({
  component: BudgetPage,
});

function BudgetPage() {
  const { data: rows = [] } = useBudget();
  const totalSubsidy = rows.reduce((s, r) => s + r.subsidy * r.ridership, 0);
  const avgCost = rows.reduce((s, r) => s + r.costPerRider, 0) / Math.max(1, rows.length);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Budget & Subsidy" subtitle="Cost-per-rider × neighborhood income · equity-weighted" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Avg cost / rider" value={`$${avgCost.toFixed(2)}`} icon={Wallet} accent="primary" />
        <KpiCard label="Daily subsidy" value={`$${(totalSubsidy / 1000).toFixed(0)}K`} icon={TrendingDown} accent="warn" />
        <KpiCard label="Routes above target" value={rows.filter(r => r.costPerRider > 3).length} format="raw" icon={TrendingUp} accent="warn" />
        <KpiCard label="Equity index" value="74/100" delta={1.4} icon={Scale} accent="success" />
      </div>

      <ChartCard title="Cost per rider × neighborhood income" subtitle="Bubble size = ridership · Lower-left = high subsidy + low income (priority)" className="mb-6">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="equityIncome" name="Median income" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `$${(v as number / 1000).toFixed(0)}K`} />
            <YAxis type="number" dataKey="costPerRider" name="Cost / rider" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `$${(v as number).toFixed(1)}`} />
            <ZAxis type="number" dataKey="ridership" range={[60, 600]} />
            <RTooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Scatter data={rows} fill="var(--electric)" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Routes by financial efficiency">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {["Route","Long name","Cost / rider","Subsidy","Daily ridership","Median income"].map(h => <th key={h} className="text-left font-medium py-2 px-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-surface/40">
                  <td className="py-2 px-2 font-semibold">{r.name}</td>
                  <td className="py-2 px-2 text-muted-foreground">{r.longName}</td>
                  <td className="py-2 px-2">${r.costPerRider.toFixed(2)}</td>
                  <td className="py-2 px-2" style={{ color: r.subsidy > 0 ? "var(--warn)" : "var(--success)" }}>
                    {r.subsidy > 0 ? "+" : ""}${r.subsidy.toFixed(2)}
                  </td>
                  <td className="py-2 px-2">{r.ridership.toLocaleString()}</td>
                  <td className="py-2 px-2 text-muted-foreground">${(r.equityIncome / 1000).toFixed(0)}K</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}