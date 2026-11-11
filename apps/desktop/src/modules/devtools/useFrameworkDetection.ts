import { ref, watch, type Ref } from "vue";
import { useCDP } from "@/composables/useCDP";
import { isNativeAppTarget } from "@/lib/app-target";
import { FRAMEWORK_DETECTION, type Framework } from "./frameworkDetection";

export type DetectionState = "checking" | "present" | "absent" | "unavailable";

/**
 * Whether the selected page runs `framework`, checked when the tab opens, when the target changes
 * and on request. A page that cannot be asked (no target, no WebView) is `unavailable`, never
 * `absent`, so the tab never claims a framework is missing when it could not look.
 */
export function useFrameworkDetection(framework: Readonly<Ref<Framework>>) {
  const cdp = useCDP();
  const state = ref<DetectionState>("checking");
  let revision = 0;

  async function check() {
    const attempt = ++revision;
    const target = cdp.targetsStore.selectedTarget;
    if (!target || isNativeAppTarget(target)) {
      state.value = "unavailable";
      return;
    }
    state.value = "checking";
    try {
      const client = cdp.getClient(target.id) ?? (await cdp.connectToTarget(target));
      const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
        expression: FRAMEWORK_DETECTION[framework.value],
        returnByValue: true,
      });
      if (attempt !== revision) return;
      state.value = result.result.value === true ? "present" : "absent";
    } catch (error) {
      if (attempt !== revision) return;
      console.warn(`Could not check the page for ${framework.value}`, error);
      state.value = "unavailable";
    }
  }

  watch(
    [framework, () => cdp.targetsStore.selectedTarget?.id ?? null],
    () => {
      void check();
    },
    { immediate: true },
  );

  return { state, check };
}
