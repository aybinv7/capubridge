import { computed, onMounted, onUnmounted, ref } from "vue";
import { loadPersistedAutomationTasks, subscribeAutomationTaskEvents } from "./taskEvents";
import type { AutomationTaskEvent } from "@/types/automation.types";
import type { PersistedAutomationTaskSnapshot } from "./taskEvents";

export function useAutomationTaskHistory() {
  const snapshots = ref<PersistedAutomationTaskSnapshot[]>([]);
  const selectedTaskId = ref<string | null>(null);
  const selectedEventId = ref<string | null>(null);
  const inspectorOpen = ref(false);
  let unlisten: (() => void) | null = null;

  const tasks = computed(() =>
    [...snapshots.value].sort((left, right) => right.task.updatedAt - left.task.updatedAt),
  );
  const selectedTask = computed(
    () => tasks.value.find((snapshot) => snapshot.task.id === selectedTaskId.value) ?? null,
  );
  const selectedEvent = computed(() => {
    const task = selectedTask.value;
    if (task === null) {
      return null;
    }
    return task.events.find((event) => event.id === selectedEventId.value) ?? null;
  });

  async function reload(): Promise<void> {
    try {
      snapshots.value = await loadPersistedAutomationTasks();
    } catch {
      snapshots.value = [];
    }
  }

  function selectEvent(taskId: string, eventId: string): void {
    selectedTaskId.value = taskId;
    selectedEventId.value = eventId;
    inspectorOpen.value = true;
  }

  function selectTask(taskId: string): void {
    const snapshot = tasks.value.find((item) => item.task.id === taskId);
    if (snapshot === undefined) {
      return;
    }
    selectedTaskId.value = taskId;
    const last = snapshot.events.at(-1);
    selectedEventId.value = last?.id ?? null;
    inspectorOpen.value = last !== undefined;
  }

  function applyEvent(event: AutomationTaskEvent): void {
    const snapshot = snapshots.value.find((item) => item.task.id === event.taskId);
    if (snapshot === undefined) {
      void reload();
      return;
    }
    if (snapshot.events.some((item) => item.id === event.id)) {
      return;
    }
    snapshots.value = snapshots.value.map((item) =>
      item.task.id === event.taskId
        ? {
            ...item,
            events: [...item.events, event],
            task: { ...item.task, updatedAt: event.occurredAt },
          }
        : item,
    );
  }

  onMounted(() => {
    void reload();
    void subscribeAutomationTaskEvents(applyEvent).then((dispose) => {
      unlisten = dispose;
    });
  });

  onUnmounted(() => {
    unlisten?.();
  });

  return {
    tasks,
    selectedTaskId,
    selectedTask,
    selectedEvent,
    inspectorOpen,
    reload,
    selectTask,
    selectEvent,
  };
}
