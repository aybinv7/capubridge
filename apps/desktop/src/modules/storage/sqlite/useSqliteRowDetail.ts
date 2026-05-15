import { ref, computed, onMounted, onUnmounted } from "vue";
import { toast } from "vue-sonner";
import type { Row } from "@tanstack/vue-table";
import type { RowRecord } from "./useSqliteAdvancedFilters";

interface UseSqliteRowDetailOptions {
  getFilteredRows: () => Row<RowRecord>[];
  columnNames: () => string[];
  canEdit?: () => boolean;
  onEdit?: (original: RowRecord, updated: Record<string, unknown>) => void;
  onDelete?: (record: RowRecord) => void;
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
  const canEdit = computed(() => options.canEdit?.() ?? false);

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

  function stringifyValue(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return `${value}`;
    }
    if (typeof value === "object") return JSON.stringify(value);
    return "";
  }

  function getRowLabel(record: RowRecord): string {
    const cols = columnNames();
    if (cols.length > 0) {
      const firstVal = record[cols[0]!];
      const label = stringifyValue(firstVal);
      if (label !== "") return label;
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

  function saveEdit() {
    const original = selectedRow.value;
    if (!original || !jsonEditorValid.value || !isDirty.value) return;
    if (!canEdit.value) {
      toast.error("Cannot save", {
        description: "Table has no primary key — editing requires one to identify rows.",
      });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(editJson.value);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      toast.error("Cannot save", { description: "Row must be a JSON object." });
      return;
    }
    options.onEdit?.(original, parsed as Record<string, unknown>);
    editOriginalJson.value = editJson.value;
  }

  function deleteRow() {
    const original = selectedRow.value;
    if (!original) return;
    if (!canEdit.value) {
      toast.error("Cannot delete", {
        description: "Table has no primary key — deletion requires one to identify rows.",
      });
      return;
    }
    options.onDelete?.(original);
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
    canEdit,
    isDirty,
    dialogEntrySize,
    openRowDetail,
    navigateRow,
    copyToClipboard,
    saveEdit,
    deleteRow,
  };
}
