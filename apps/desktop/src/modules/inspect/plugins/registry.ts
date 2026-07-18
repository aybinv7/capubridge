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

export function findInspectPluginById(id: string) {
  return plugins.value.find((plugin) => plugin.id === id) ?? null;
}

export function findInspectPluginByRouteSegment(routeSegment: string) {
  return plugins.value.find((plugin) => plugin.routeSegment === routeSegment) ?? null;
}

export async function detectPlugins(
  evaluate: (expr: string) => Promise<unknown>,
): Promise<InspectPlugin[]> {
  const detected: InspectPlugin[] = [];
  for (const plugin of plugins.value) {
    try {
      if (await plugin.detect(evaluate)) {
        detected.push(plugin);
      }
    } catch (error) {
      console.warn("Inspect plugin detection failed", plugin.id, error);
    }
  }
  return detected;
}
