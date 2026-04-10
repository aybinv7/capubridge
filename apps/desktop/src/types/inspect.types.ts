import type { Component } from "vue";

export type { DOMNode, BoxModel, MatchedStyles, ComputedStyle } from "utils";

/** Parsed attribute pair from CDP's flat attribute array */
export interface DOMAttribute {
  name: string;
  value: string;
}

/** Detail tabs in the element detail panel */
export type DetailTab = "styles" | "computed" | "boxmodel";

/** Plugin system interface — each framework devtools plugin implements this */
export interface InspectPlugin {
  /** Unique identifier, e.g. "vue-devtools" */
  id: string;
  /** Display name shown in the tab */
  name: string;
  /** Lucide icon component or custom SVG component */
  icon: Component;
  /** Check if the target app uses this framework */
  detect: (evaluate: (expr: string) => Promise<unknown>) => Promise<boolean>;
  /** Component to render when this tab is active — receives `cdpWsUrl` prop */
  component: () => Promise<Component>;
}
