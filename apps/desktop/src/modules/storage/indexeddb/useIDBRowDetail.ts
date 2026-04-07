import { ref, computed, onMounted, onUnmounted } from "vue";
import type { Row } from "@tanstack/vue-table";
import type { IDBRecord } from "utils";

interface UseIDBRowDetailOptions {
  getFilteredRows: () => Row<IDBRecord>[];
  totalRecords: () => number | undefined;
  fetchRecord: () => ((index: number) => Promise<IDBRecord | null>) | undefined;
  onEdit: (record: IDBRecord) => void;
  onDelete: (key: IDBValidKey) => void;
}

export function useIDBRowDetail(options: UseIDBRowDetailOptions) {
  const { getFilteredRows, totalRecords, fetchRecord, onEdit, onDelete } = options;

  const selectedRow = ref<IDBRecord | null>(null);
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

  function openRowDetail(record: IDBRecord, rowIndex?: number) {
    selectedRow.value = record;
    isDetailOpen.value = true;
    editJson.value = JSON.stringify(record.value, null, 2);
    editOriginalJson.value = editJson.value;
    editKey.value = String(record.key);
    jsonEditorValid.value = true;
    if (rowIndex !== undefined) currentRowIndex.value = rowIndex;
    copiedRaw.value = false;
  }

  async function navigateRow(direction: "prev" | "next") {
    const filteredRows = getFilteredRows();
    const total = totalRecords() ?? filteredRows.length;
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
      editJson.value = JSON.stringify(localRow.original.value, null, 2);
      editOriginalJson.value = editJson.value;
      editKey.value = String(localRow.original.key);
      jsonEditorValid.value = true;
      copiedRaw.value = false;
    } else {
      const fn = fetchRecord();
      if (fn) {
        const record = await fn(nextIdx);
        if (record) {
          currentRowIndex.value = nextIdx;
          selectedRow.value = record;
          editJson.value = JSON.stringify(record.value, null, 2);
          editOriginalJson.value = editJson.value;
          editKey.value = String(record.key);
          jsonEditorValid.value = true;
          copiedRaw.value = false;
        }
      }
    }
  }

  function saveEdit() {
    if (!selectedRow.value || !jsonEditorValid.value) return;
    try {
      const parsed = JSON.parse(editJson.value);
      onEdit({ key: selectedRow.value.key, value: parsed });
      editOriginalJson.value = editJson.value;
    } catch {
      // Invalid JSON — editor already marks it invalid
    }
  }

  function deleteRow() {
    if (!selectedRow.value) return;
    onDelete(selectedRow.value.key);
    const total = totalRecords() ?? getFilteredRows().length;
    navigateRow("next");
    if (currentRowIndex.value >= total) {
      isDetailOpen.value = false;
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    copiedRaw.value = true;
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
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      saveEdit();
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
    saveEdit,
    deleteRow,
    copyToClipboard,
  };
}
