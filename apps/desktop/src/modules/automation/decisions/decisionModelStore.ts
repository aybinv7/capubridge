import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { findDecisionModel, listDecisionModels, requireDecisionModel } from "./decisionModels";
import type { DecisionModelDescriptor } from "./decisionModels";
import { readDecisionModelId, writeDecisionModelId } from "./decisionModelSetting";

/** The selected decision model, persisted per machine. */
export const useDecisionModelStore = defineStore("automation-decision-model", () => {
  const modelId = ref<string>(readDecisionModelId());
  const persistFailed = ref(false);

  const models = computed<readonly DecisionModelDescriptor[]>(() => listDecisionModels());
  const selected = computed<DecisionModelDescriptor>(
    () => findDecisionModel(modelId.value) ?? requireDecisionModel(readDecisionModelId()),
  );

  function select(id: string): void {
    if (findDecisionModel(id) === null) {
      return;
    }
    modelId.value = id;
    persistFailed.value = !writeDecisionModelId(id);
  }

  return { modelId, models, selected, persistFailed, select };
});
