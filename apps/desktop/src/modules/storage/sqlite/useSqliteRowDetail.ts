import { ref, computed, onMounted, onUnmounted } from "vue";
import { toast } from "vue-sonner";
import type { Row } from "@tanstack/vue-table";
import type { RowRecord } from "./useSqliteAdvancedFilters";

interface UseSqliteRowDetailOptions {
  getFilteredRows: () => Row<RowRecord>[];
  columnNames: () => string[];
}

export function useSqliteRowDetail(options: UseSqliteRowDetailOptions) {
  const { getFilteredRows, columnNames } = options;

  const selectedRow = ref<RowRecord | null>(null);
  const isDetailOpen = ref(false);
  const editJson = ref("");
  const editOriginalJson = ref("");
  const editKey = ref("");
  const jsonEditorValid = ref(true);
  const currentRowIndex = ref(-1);
  const copiedRaw = ref(false);

  const isDirty = computed(() => editJson.value !== editOriginalJson.value);

  const badge = computed<null | "unsaved" | "invalid">(() => {
    if (!jsonEditorValid.value) return "invalid";
    if (isDirty.value) return "unsaved";
    return null;
  });

  const dialogEntrySize = computed(() => {
    const val = editJson.value;
    if (!val) return "0 B";
    const bytes = new Blob([val]).size;
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  });

  function getRowLabel(record: RowRecord): string {
    // Try to find a good label: first column, or rowid, or index
    const cols = columnNames();
    if (cols.length > 0) {
      const firstVal = record[cols[0]!];
      if (firstVal !== null && firstVal !== undefined) return String(firstVal);
    }
    return `Row`;
  }

  function openRowDetail(record: RowRecord, rowIndex?: number) {
    selectedRow.value = record;
    isDetailOpen.value = true;
    editJson.value = JSON.stringify(record, null, 2);
    editOriginalJson.value = editJson.value;
    editKey.value = getRowLabel(record);
    jsonEditorValid.value = true;
    if (rowIndex !== undefined) currentRowIndex.value = rowIndex;
    copiedRaw.value = false;
  }

  function navigateRow(direction: "prev" | "next") {
    const filteredRows = getFilteredRows();
    const total = filteredRows.length;
    if (total === 0) return;

    let nextIdx: number;
    if (currentRowIndex.value < 0) {
      nextIdx = direction === "next" ? 0 : total - 1;
    } else {
      nextIdx =
        direction === "next"
          ? Math.min(currentRowIndex.value + 1, total - 1)
          : Math.max(currentRowIndex.value - 1, 0);
    }

    const localRow = filteredRows[nextIdx];
    if (localRow) {
      currentRowIndex.value = nextIdx;
      selectedRow.value = localRow.original;
      editJson.value = JSON.stringify(localRow.original, null, 2);
      editOriginalJson.value = editJson.value;
      editKey.value = getRowLabel(localRow.original);
      jsonEditorValid.value = true;
      copiedRaw.value = false;
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    copiedRaw.value = true;
    toast.success("Copied to clipboard");
    setTimeout(() => (copiedRaw.value = false), 2000);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isDetailOpen.value) return;
    if (e.ctrlKey && e.key === "ArrowUp") {
      e.preventDefault();
      navigateRow("prev");
    }
    if (e.ctrlKey && e.key === "ArrowDown") {
      e.preventDefault();
      navigateRow("next");
    }
  }

  onMounted(() => window.addEventListener("keydown", handleKeydown));
  onUnmounted(() => window.removeEventListener("keydown", handleKeydown));

  return {
    selectedRow,
    isDetailOpen,
    editJson,
    editKey,
    jsonEditorValid,
    currentRowIndex,
    copiedRaw,
    badge,
    dialogEntrySize,
    openRowDetail,
    navigateRow,
    copyToClipboard,
  };
}
