import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import {
  MOBILE_PRIMARY_ITEMS, MOBILE_MORE_ITEMS, isNavActive, type NavTone,
} from "@/lib/nav";
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";

/** Literal Tailwind classes per tone so they survive purging. */
const TONE: Record<NavTone, { text: string; chip: string }> = {
  primary:     { text: "text-primary",            chip: "bg-primary/15" },
  accent:      { text: "text-accent",             chip: "bg-accent/15" },
  cyan:        { text: "text-cyan",               chip: "bg-cyan/15" },
  success:     { text: "text-success",            chip: "bg-success/15" },
  warn:        { text: "text-warn",               chip: "bg-warn/15" },
  destructive: { text: "text-destructive",        chip: "bg-destructive/15" },
  muted:       { text: "text-muted-foreground",   chip: "bg-muted-foreground/10" },
};

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { setCommandOpen } = useUI();
  const [moreOpen, setMoreOpen] = useState(false);

  // "More" is active when the current page isn't one of the pinned tabs.
  const moreActive = MOBILE_MORE_ITEMS.some((it) => isNavActive(it.to, path));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-[1000] glass-panel border-t border-border">
        <div className="grid grid-cols-5">
          {MOBILE_PRIMARY_ITEMS.map((it) => {
            const active = isNavActive(it.to, path);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {it.short ?? it.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More pages"
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px]",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Menu className="size-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          showClose={false}
          className="md:hidden glass-panel rounded-t-2xl border-border p-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border" />

          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <SheetTitle className="text-base">More</SheetTitle>
            <SheetClose
              aria-label="Close menu"
              className="flex size-8 items-center justify-center rounded-full bg-surface/60 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus:outline-none"
            >
              <X className="size-4" />
            </SheetClose>
          </div>

          <div className="grid grid-cols-2 gap-2.5 px-4 pt-3">
            {MOBILE_MORE_ITEMS.map((it) => {
              const active = isNavActive(it.to, path);
              const Icon = it.icon;
              const tone = TONE[it.tone ?? "muted"];
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/60 text-foreground/90 hover:bg-sidebar-accent/60",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary" />
                  )}
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone.chip)}>
                    <Icon className={cn("size-[18px]", tone.text)} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">{it.label}</span>
                  {active && <span className="size-1.5 shrink-0 rounded-full bg-primary animate-pulse-glow" />}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              setCommandOpen(true);
            }}
            className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-surface"
          >
            <Search className="size-[18px] shrink-0" />
            Search routes, stops, neighbourhoods…
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
