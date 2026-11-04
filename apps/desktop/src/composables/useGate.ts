import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { gateSubjectKey, resolveGate } from "@/lib/gates/resolve";
import type { GateRequirement } from "@/lib/gates/types";

/**
 * - `open`: render the screen.
 * - `degraded`: the screen already rendered for this subject; keep it mounted and flag it stale.
 * - `blocked`: nothing truthful to show yet; render the gate instead.
 */
export type GateMode = "open" | "degraded" | "blocked";

/** Resolves a screen's requirement against the active context and remembers what already rendered. */
export function useGate(requirement: MaybeRefOrGetter<GateRequirement>) {
  const context = useActiveContextStore();
  const result = computed(() => resolveGate(toValue(requirement), context.gateInput));
  const subject = computed(() => gateSubjectKey(toValue(requirement), context.gateInput));
  const renderedFor = ref<string | null>(null);

  watch(
    () => (result.value.kind === "open" ? subject.value : null),
    (openSubject) => {
      if (openSubject !== null) renderedFor.value = openSubject;
    },
    { immediate: true },
  );

  const mode = computed<GateMode>(() => {
    if (result.value.kind === "open") return "open";
    return renderedFor.value === subject.value ? "degraded" : "blocked";
  });

  return { result, subject, mode };
}
