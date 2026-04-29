import { ref, computed, onMounted, onUnmounted } from "vue";
import { toast } from "vue-sonner";
import type { Row } from "@tanstack/vue-table";
import type { IDBRecord } from "utils";

interface UseIDBRowDetailOptions {
  getFilteredRows: () => Row<IDBRecord>[];
  totalRecords: () => number | undefined;
  fetchRecord: () => ((index: number) => Promise<IDBRecord | null>) | undefined;
  onEdit: (record: IDBRecord) => void;
  onDelete: (key: IDBValidKey) => void;
  canMutate?: (record: IDBRecord) => boolean;
}

export function useIDBRowDetail(options: UseIDBRowDetailOptions) {
  const { getFilteredRows, totalRecords, fetchRecord, onEdit, onDelete } = options;

  const selectedRow = ref<IDBRecord | null>(null);
  const selectedKey = ref<unknown>(null);
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

  function stringifyKey(key: IDBValidKey): string {
    if (typeof key === "string" || typeof key === "number" || typeof key === "bigint") {
      return `${key}`;
    }
    if (key instanceof Date) {
      return key.toISOString();
    }
    if (Array.isArray(key)) {
      return JSON.stringify(key);
    }
    return "";
  }

  function openRowDetail(record: IDBRecord, rowIndex?: number) {
    selectedRow.value = record;
    selectedKey.value = record.key;
    isDetailOpen.value = true;
    editJson.value = JSON.stringify(record.value, null, 2);
    editOriginalJson.value = editJson.value;
    editKey.value = stringifyKey(record.key);
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
      selectedKey.value = localRow.original.key;
      editJson.value = JSON.stringify(localRow.original.value, null, 2);
      editOriginalJson.value = editJson.value;
      editKey.value = stringifyKey(localRow.original.key);
      jsonEditorValid.value = true;
      copiedRaw.value = false;
    } else {
      const fn = fetchRecord();
      if (fn) {
        const record = await fn(nextIdx);
        if (record) {
          currentRowIndex.value = nextIdx;
          selectedRow.value = record;
          selectedKey.value = record.key;
          editJson.value = JSON.stringify(record.value, null, 2);
          editOriginalJson.value = editJson.value;
          editKey.value = stringifyKey(record.key);
          jsonEditorValid.value = true;
          copiedRaw.value = false;
        }
      }
    }
  }

  function saveEdit() {
    if (!selectedRow.value || selectedKey.value == null || !jsonEditorValid.value) return;
    if (options.canMutate && !options.canMutate(selectedRow.value)) return;
    try {
      const parsed: unknown = JSON.parse(editJson.value);
      const record: IDBRecord = {
        key: selectedKey.value as IDBValidKey,
        value: parsed,
      };
      onEdit(record);
      editOriginalJson.value = editJson.value;
      toast.success("Record saved", { description: `Key: ${editKey.value}` });
    } catch {
      // Invalid JSON — editor already marks it invalid
    }
  }

  function deleteRow() {
    if (selectedKey.value == null) return;
    if (selectedRow.value && options.canMutate && !options.canMutate(selectedRow.value)) return;
    onDelete(selectedKey.value as IDBValidKey);
    toast.success("Record deleted", { description: `Key: ${editKey.value}` });
    const total = totalRecords() ?? getFilteredRows().length;
    void navigateRow("next");
    if (currentRowIndex.value >= total) {
      isDetailOpen.value = false;
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
      void navigateRow("prev");
    }
    if (e.ctrlKey && e.key === "ArrowDown") {
      e.preventDefault();
      void navigateRow("next");
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
