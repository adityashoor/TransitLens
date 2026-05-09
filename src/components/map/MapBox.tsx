import { ClientOnly } from "@/components/ClientOnly";
import { TransitMap } from "@/components/map/TransitMap";
import type { ComponentProps } from "react";

export function MapBox(props: ComponentProps<typeof TransitMap>) {
  return (
    <ClientOnly fallback={<div className="size-full grid place-items-center text-xs text-muted-foreground">Loading map…</div>}>
      <TransitMap {...props} />
    </ClientOnly>
  );
}
