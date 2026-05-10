import { Cpu, RefreshCw, Database, Target } from "lucide-react";
import { MODEL_CARD } from "@/mock/predictions";
import { DataCard } from "@/components/ui-ext/DataCard";

export function ModelCard() {
  const items = [
    { icon: Cpu, label: "Algorithm", value: MODEL_CARD.algorithm },
    { icon: Database, label: "Training window", value: `${MODEL_CARD.windowDays} days` },
    { icon: Target, label: "MAE / MAPE", value: `${MODEL_CARD.mae} / ${MODEL_CARD.mape}` },
    { icon: RefreshCw, label: "Refresh", value: MODEL_CARD.refreshedEvery },
  ];
  return (
    <DataCard
      title={`${MODEL_CARD.name} · ${MODEL_CARD.version}`}
      subtitle={`Last trained ${MODEL_CARD.trainedOn} · ${MODEL_CARD.features} features · ${MODEL_CARD.coverage}`}
      icon={<Cpu className="size-5 text-primary" />}
      footer={MODEL_CARD.notes}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-surface/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Icon className="size-3" /> {label}
            </div>
            <div className="text-sm font-semibold mt-1 leading-snug">{value}</div>
          </div>
        ))}
      </div>
    </DataCard>
  );
}
