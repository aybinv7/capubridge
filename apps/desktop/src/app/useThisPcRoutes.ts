import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { deviceOnlyPaths } from "@/app/feature-registry";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";

const THIS_PC_HOME = "/storage";

/**
 * This PC has no Device or App page, so becoming the context while one is open moves to Data
 * instead of leaving a page the rail no longer offers.
 */
export function useThisPcRoutes() {
  const route = useRoute();
  const router = useRouter();
  const thisPc = useThisPcBrowserStore();

  watch(
    () => [thisPc.active, route.path] as const,
    ([active, path]) => {
      if (!active || !deviceOnlyPaths.some((prefix) => path.startsWith(prefix))) return;
      void router.replace(THIS_PC_HOME).catch((error: unknown) => {
        console.warn("Could not leave a page This PC has no use for", error);
      });
    },
    { immediate: true },
  );
}
