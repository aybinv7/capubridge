import { ref, watch } from "vue";
import { readPersisted, writePersisted } from "@/lib/persisted";

const PANE_KEY = "capubridge:data-record-pane";

/** Whether the record pane is shown, shared by every Data tab and remembered. */
export const recordPaneOpen = ref(
  readPersisted<boolean>(PANE_KEY, true, (value) => typeof value === "boolean"),
);
watch(recordPaneOpen, (value) => writePersisted(PANE_KEY, value));

/** Shows or hides the record pane wherever it is mounted (palette command). */
export function toggleRecordPane() {
  recordPaneOpen.value = !recordPaneOpen.value;
}
