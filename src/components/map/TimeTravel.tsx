import { Play, Pause, Rewind, FastForward, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useUI } from "@/store/ui";

export function TimeTravel() {
  const { timeOffset, setTimeOffset } = useUI();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = timeOffset + 2;
      if (next >= 0) {
        setTimeOffset(0);
        setPlaying(false);
      } else {
        setTimeOffset(next);
      }
    }, 200);
    return () => clearInterval(id);
  }, [playing, timeOffset, setTimeOffset]);

  const label =
    timeOffset === 0
      ? "Live"
      : `${Math.abs(timeOffset)} min ${timeOffset < 0 ? "ago" : "ahead"}`;

  return (
    <div className="glass-card rounded-2xl p-3 w-[min(560px,calc(100vw-2rem))]">
      <div className="flex items-center gap-3">
        <Clock className="size-4 text-primary shrink-0" />
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time travel</div>
        <div className="ml-auto text-xs tabular-nums font-medium">{label}</div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setTimeOffset(Math.max(-60, timeOffset - 5))}
          className="size-8 rounded-lg bg-surface/60 border border-border flex items-center justify-center hover:bg-surface"
          aria-label="Rewind 5 minutes"
        >
          <Rewind className="size-3.5" />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <button
          onClick={() => setTimeOffset(Math.min(0, timeOffset + 5))}
          className="size-8 rounded-lg bg-surface/60 border border-border flex items-center justify-center hover:bg-surface"
          aria-label="Forward 5 minutes"
        >
          <FastForward className="size-3.5" />
        </button>
        <input
          type="range"
          min={-60}
          max={0}
          step={1}
          value={timeOffset}
          onChange={(e) => setTimeOffset(Number(e.target.value))}
          className="flex-1 accent-primary"
          aria-label="Time offset in minutes"
        />
        <button
          onClick={() => { setTimeOffset(0); setPlaying(false); }}
          className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-surface"
        >
          Now
        </button>
      </div>
    </div>
  );
}
