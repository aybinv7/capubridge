import "vue-router";
import type { GateRequirement } from "@/lib/gates/types";

declare module "vue-router" {
  interface RouteMeta {
    /** What the screen needs before it can render; the panel shows a gate until it is met. */
    requires?: GateRequirement;
    /** The screen offers its own "Bring to front", so the strip and the phone column do not. */
    ownsBringToFront?: boolean;
    /** A hidden route that belongs to another tab, which stays selected while it is open. */
    tabPath?: string;
    /** A command the gate offers beside its own actions (for example, open a file instead). */
    gateCommand?: { commandId: string; label: string; hint?: string };
    /** Extra words the command palette matches this destination on. */
    keywords?: readonly string[];
  }
}
