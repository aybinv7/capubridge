import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { Flow, FlowStep, FlowStepOp } from "@/types/automation.types";
import { createEmptyFlow } from "./flowSchema";
import {
  createStep,
  deleteStep,
  duplicateFlow,
  flowRunnability,
  moveStep,
  replaceStep,
} from "./flowEditorState";
import type { FlowRunnability } from "./flowEditorState";
import { createLocalStorageFlowStorage } from "./flowStorage";

/**
 * Flow library store. Presentation state only: the library persists through
 * the storage seam, and every mutation validates through the schema helpers.
 */
export const useFlowStore = defineStore("automation-flows", () => {
  const storage = createLocalStorageFlowStorage();
  const flows = ref<Flow[]>([]);
  const activeId = ref<string | null>(null);
  const loaded = ref(false);

  const activeFlow = computed<Flow | null>(
    () => flows.value.find((flow) => flow.id === activeId.value) ?? null,
  );

  const runnability = computed<FlowRunnability>(() =>
    activeFlow.value === null
      ? { runnable: false, reason: "no flow selected" }
      : flowRunnability(activeFlow.value),
  );

  function persist(): void {
    storage.saveAll(flows.value);
  }

  function loadFlows(): void {
    flows.value = storage.list();
    loaded.value = true;
    if (activeId.value === null && flows.value.length > 0) {
      activeId.value = flows.value[0]?.id ?? null;
    }
  }

  function selectFlow(id: string): void {
    if (flows.value.some((flow) => flow.id === id)) {
      activeId.value = id;
    }
  }

  function createFlow(name: string, appPackage: string): void {
    const flow = createEmptyFlow(name, appPackage);
    flows.value = [...flows.value, flow];
    activeId.value = flow.id;
    persist();
  }

  function renameFlow(id: string, name: string): void {
    flows.value = flows.value.map((flow) => (flow.id === id ? { ...flow, name } : flow));
    persist();
  }

  function duplicateFlowById(id: string): void {
    const source = flows.value.find((flow) => flow.id === id);
    if (source === undefined) {
      return;
    }
    const copy = duplicateFlow(source);
    flows.value = [...flows.value, copy];
    activeId.value = copy.id;
    persist();
  }

  function deleteFlow(id: string): void {
    flows.value = flows.value.filter((flow) => flow.id !== id);
    if (activeId.value === id) {
      activeId.value = flows.value[0]?.id ?? null;
    }
    persist();
  }

  function importFlow(flow: Flow): void {
    flows.value = [...flows.value.filter((entry) => entry.id !== flow.id), flow];
    activeId.value = flow.id;
    persist();
  }

  function mutateActive(mutator: (flow: Flow) => Flow): void {
    const active = activeFlow.value;
    if (active === null) {
      return;
    }
    flows.value = flows.value.map((flow) => (flow.id === active.id ? mutator(flow) : flow));
    persist();
  }

  function setAcceptanceScenario(scenario: Flow["acceptanceScenario"]): void {
    mutateActive((flow) => {
      if (scenario === undefined) {
        const { acceptanceScenario: _removed, ...rest } = flow;
        return {
          ...rest,
          steps: flow.steps.map((step) => {
            const { acceptanceMilestone: _cleared, ...remaining } = step;
            return remaining as FlowStep;
          }),
        };
      }
      return { ...flow, acceptanceScenario: scenario };
    });
  }

  function addStep(op: FlowStepOp): void {
    mutateActive((flow) => ({ ...flow, steps: [...flow.steps, createStep(op)] }));
  }

  function updateStep(index: number, step: FlowStep): void {
    mutateActive((flow) => ({ ...flow, steps: replaceStep(flow.steps, index, step) }));
  }

  function moveStepBy(from: number, to: number): void {
    mutateActive((flow) => ({ ...flow, steps: moveStep(flow.steps, from, to) }));
  }

  function deleteStepBy(index: number): void {
    mutateActive((flow) => ({ ...flow, steps: deleteStep(flow.steps, index) }));
  }

  return {
    flows,
    activeId,
    activeFlow,
    runnability,
    loaded,
    loadFlows,
    selectFlow,
    createFlow,
    renameFlow,
    duplicateFlowById,
    deleteFlow,
    importFlow,
    setAcceptanceScenario,
    addStep,
    updateStep,
    moveStepBy,
    deleteStepBy,
  };
});
