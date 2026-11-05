import "vue-router";
import type { GateRequirement } from "@/lib/gates/types";

declare module "vue-router" {
  interface RouteMeta {
    /** What the screen needs before it can render; the panel shows a gate until it is met. */
    requires?: GateRequirement;
    /** The screen offers its own "Bring to front", so the strip and the phone column do not. */
    ownsBringToFront?: boolean;
  }
}
