import type { Component } from "vue";

/** Interface that every framework devtools plugin must implement */
export interface InspectPlugin {
  /** Unique identifier, e.g. "vue-devtools" */
  id: string;
  /** Display name shown in the tab */
  name: string;
  /** Lucide icon component or custom SVG component */
  icon: Component;
  /** Detection function: return true if target app uses this framework */
  detect: (evaluate: (expr: string) => Promise<unknown>) => Promise<boolean>;
  /** Component to render when this tab is active — receives `cdpWsUrl` prop */
  component: () => Promise<Component>;
}
