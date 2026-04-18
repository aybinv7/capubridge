import { ref } from "vue";
import { defineStore } from "pinia";

export const useStorageContextStore = defineStore("storage-context", () => {
  const selectedOriginsByTarget = ref<Record<string, string>>({});

  function getSelectedOrigin(targetId: string): string {
    if (!targetId) return "";
    return selectedOriginsByTarget.value[targetId] ?? "";
  }

  function setSelectedOrigin(targetId: string, origin: string) {
    if (!targetId) return;
    selectedOriginsByTarget.value = {
      ...selectedOriginsByTarget.value,
      [targetId]: origin,
    };
  }

  function clearTarget(targetId: string) {
    if (!targetId || !(targetId in selectedOriginsByTarget.value)) return;

    const next = { ...selectedOriginsByTarget.value };
    delete next[targetId];
    selectedOriginsByTarget.value = next;
  }

  function clearAll() {
    selectedOriginsByTarget.value = {};
  }

  return {
    selectedOriginsByTarget,
    getSelectedOrigin,
    setSelectedOrigin,
    clearTarget,
    clearAll,
  };
});
