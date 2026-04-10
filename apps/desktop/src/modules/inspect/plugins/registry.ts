import { shallowRef } from "vue";
import type { InspectPlugin } from "./types";

const plugins = shallowRef<InspectPlugin[]>([]);

export function registerInspectPlugin(plugin: InspectPlugin) {
  if (plugins.value.some((p) => p.id === plugin.id)) return;
  plugins.value = [...plugins.value, plugin];
}

export function getInspectPlugins() {
  return plugins;
}

/** Detect which plugins apply to the current target */
export async function detectPlugins(
  evaluate: (expr: string) => Promise<unknown>,
): Promise<InspectPlugin[]> {
  const detected: InspectPlugin[] = [];
  for (const plugin of plugins.value) {
    try {
      if (await plugin.detect(evaluate)) {
        detected.push(plugin);
      }
    } catch {
      // Detection failed — skip
    }
  }
  return detected;
}
