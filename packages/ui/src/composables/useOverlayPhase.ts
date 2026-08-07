import { shallowRef, watch, type Ref } from "vue";

import type { OverlayPhase } from "../foundations/contracts.ts";

export interface OverlayPhaseController {
  phase: Readonly<Ref<OverlayPhase>>;
  setPhase: (phase: OverlayPhase) => void;
}

export function useOverlayPhase(open: Ref<boolean>): OverlayPhaseController {
  const phase = shallowRef<OverlayPhase>("closed");

  watch(
    open,
    (value) => {
      if (value) {
        if (phase.value === "closed" || phase.value === "closing") {
          phase.value = "opening";
        }
        return;
      }

      if (phase.value === "opening" || phase.value === "opened") {
        phase.value = "closing";
      }
    },
    { immediate: true },
  );

  function setPhase(next: OverlayPhase): void {
    phase.value = next;

    if (next === "closed") {
      if (open.value) open.value = false;
      return;
    }

    if (next === "opening" && !open.value) open.value = true;
  }

  return { phase, setPhase };
}
