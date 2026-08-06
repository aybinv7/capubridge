import { computed, effectScope, ref, watch } from "vue";
import { useCDP } from "@/composables/useCDP";
// Registration must not depend on a lazy route component: SubNavTabs asks for
// the plugin list at app boot, long before /inspect is ever visited.
import "./plugins/init";
import {
  detectPlugins,
  findInspectPluginByRouteSegment,
  getInspectPlugins,
} from "./plugins/registry";

const detectedPluginIds = ref<string[]>([]);
const isDetecting = ref(false);

let detectionScope: ReturnType<typeof effectScope> | null = null;

async function ensureTargetClient(cdp: ReturnType<typeof useCDP>) {
  const target = cdp.targetsStore.selectedTarget;
  if (!target) return null;

  let client = cdp.activeClient.value;
  if (!client) {
    try {
      client = await cdp.connectToTarget(target);
    } catch {
      return null;
    }
  }

  return client;
}

async function runPluginDetection(cdp: ReturnType<typeof useCDP>) {
  const client = await ensureTargetClient(cdp);
  if (!client) {
    detectedPluginIds.value = [];
    return;
  }

  isDetecting.value = true;

  try {
    const plugins = await detectPlugins(async (expression) => {
      const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });
      return (result.result as Record<string, unknown>).value;
    });
    detectedPluginIds.value = plugins.map((plugin) => plugin.id);
  } catch {
    detectedPluginIds.value = [];
  } finally {
    isDetecting.value = false;
  }
}

export function useInspectPlugins() {
  const cdp = useCDP();
  const plugins = getInspectPlugins();

  if (!detectionScope) {
    detectionScope = effectScope(true);
    detectionScope.run(() => {
      watch(
        [
          cdp.activeClient,
          () => cdp.targetsStore.selectedTarget?.id ?? null,
          () => plugins.value.length,
        ],
        () => {
          void runPluginDetection(cdp);
        },
        { immediate: true },
      );
    });
  }

  const enabledPluginIdSet = computed(() => new Set(detectedPluginIds.value));

  async function evaluateOnTarget(expression: string) {
    const client = await ensureTargetClient(cdp);
    if (!client) return null;

    const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    return (result.result as Record<string, unknown>).value ?? null;
  }

  return {
    plugins: computed(() =>
      plugins.value.filter((plugin) => enabledPluginIdSet.value.has(plugin.id)),
    ),
    allPlugins: plugins,
    enabledPluginIds: enabledPluginIdSet,
    isDetecting,
    isPluginEnabled: (pluginId: string) => enabledPluginIdSet.value.has(pluginId),
    isRouteEnabled: (routeName: string) => {
      const plugin = plugins.value.find((item) => item.routeName === routeName);
      return plugin ? enabledPluginIdSet.value.has(plugin.id) : false;
    },
    getPluginByRouteSegment: (routeSegment: string) =>
      findInspectPluginByRouteSegment(routeSegment),
    evaluateOnTarget,
    refreshPlugins: () => runPluginDetection(cdp),
  };
}
