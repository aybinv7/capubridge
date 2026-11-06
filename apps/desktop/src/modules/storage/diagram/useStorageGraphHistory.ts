import { computed, ref } from "vue";
import { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import type { StorageGraphPersistedScope } from "@/types/storageGraph.types";

const MAX_HISTORY = 80;

function cloneScope(scope: StorageGraphPersistedScope): StorageGraphPersistedScope {
  return JSON.parse(JSON.stringify(scope)) as StorageGraphPersistedScope;
}

export function useStorageGraphHistory(scopeKey: { value: string }) {
  const graphStore = useStorageGraphStore();
  const past = ref<StorageGraphPersistedScope[]>([]);
  const future = ref<StorageGraphPersistedScope[]>([]);

  function currentScope() {
    return cloneScope(graphStore.getScope(scopeKey.value));
  }

  function reset() {
    past.value = [];
    future.value = [];
  }

  function commit() {
    const snapshot = currentScope();
    const previous = past.value[past.value.length - 1];
    if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) {
      return;
    }

    past.value = [...past.value, snapshot].slice(-MAX_HISTORY);
    future.value = [];
  }

  function undo() {
    const previous = past.value[past.value.length - 1];
    if (!previous) {
      return false;
    }

    future.value = [currentScope(), ...future.value];
    past.value = past.value.slice(0, -1);
    graphStore.replaceScope(scopeKey.value, previous);
    return true;
  }

  function redo() {
    const next = future.value[0];
    if (!next) {
      return false;
    }

    past.value = [...past.value, currentScope()];
    future.value = future.value.slice(1);
    graphStore.replaceScope(scopeKey.value, next);
    return true;
  }

  return {
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    commit,
    undo,
    redo,
    reset,
  };
}
