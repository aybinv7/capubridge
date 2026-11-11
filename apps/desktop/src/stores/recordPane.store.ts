import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";

export type RecordPanePlacement = "side" | "bottom";

const LS_PLACEMENT = "capubridge:data-record-pane-placement";

function isPlacement(value: unknown): value is RecordPanePlacement {
  return value === "side" || value === "bottom";
}

/**
 * Where a picked record opens in Data: beside the table, or below it for wide tables. One choice
 * for every database, remembered, set from Settings or any database's ⋯ menu.
 */
export const useRecordPaneStore = defineStore("recordPane", () => {
  const placement = ref<RecordPanePlacement>(
    readPersisted<RecordPanePlacement>(LS_PLACEMENT, "side", isPlacement),
  );

  watch(placement, (next) => writePersisted(LS_PLACEMENT, next));

  function togglePlacement() {
    placement.value = placement.value === "side" ? "bottom" : "side";
  }

  return { placement, togglePlacement };
});
