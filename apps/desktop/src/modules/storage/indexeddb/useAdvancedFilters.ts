import { ref, computed } from "vue";
import type { Ref } from "vue";
import type { IDBRecord } from "utils";

export type FilterOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isNull"
  | "isNotNull"
  | "isTrue"
  | "isFalse"
  | "isEmpty"
  | "isNotEmpty";

export interface AdvancedFilter {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string;
  logic: "and" | "or";
}

export const OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
  { value: "contains", label: "contains", needsValue: true },
  { value: "equals", label: "equals", needsValue: true },
  { value: "startsWith", label: "starts with", needsValue: true },
  { value: "endsWith", label: "ends with", needsValue: true },
  { value: "gt", label: "greater than", needsValue: true },
  { value: "gte", label: "≥", needsValue: true },
  { value: "lt", label: "less than", needsValue: true },
  { value: "lte", label: "≤", needsValue: true },
  { value: "isNull", label: "is null", needsValue: false },
  { value: "isNotNull", label: "is not null", needsValue: false },
  { value: "isTrue", label: "is true", needsValue: false },
  { value: "isFalse", label: "is false", needsValue: false },
  { value: "isEmpty", label: "is empty", needsValue: false },
  { value: "isNotEmpty", label: "is not empty", needsValue: false },
];

function getCellValue(cellValue: unknown): string {
  if (cellValue == null) return "";
  if (typeof cellValue === "object") return JSON.stringify(cellValue);
  return String(cellValue);
}

function matchesFilter(cellValue: unknown, operator: FilterOperator, filterValue: string): boolean {
  const str = getCellValue(cellValue);
  const lowerStr = str.toLowerCase();
  const lowerVal = filterValue.toLowerCase();

  switch (operator) {
    case "contains":
      return lowerStr.includes(lowerVal);
    case "equals":
      return lowerStr === lowerVal;
    case "startsWith":
      return lowerStr.startsWith(lowerVal);
    case "endsWith":
      return lowerStr.endsWith(lowerVal);
    case "gt":
      return Number(cellValue) > Number(filterValue);
    case "gte":
      return Number(cellValue) >= Number(filterValue);
    case "lt":
      return Number(cellValue) < Number(filterValue);
    case "lte":
      return Number(cellValue) <= Number(filterValue);
    case "isNull":
      return cellValue === null || cellValue === undefined;
    case "isNotNull":
      return cellValue !== null && cellValue !== undefined;
    case "isTrue":
      return cellValue === true;
    case "isFalse":
      return cellValue === false;
    case "isEmpty":
      return str === "" || str === "[]" || str === "{}";
    case "isNotEmpty":
      return str !== "" && str !== "[]" && str !== "{}";
    default:
      return true;
  }
}

export function useAdvancedFilters(records: Ref<IDBRecord[]>) {
  const advancedFilters = ref<AdvancedFilter[]>([]);
  let filterIdCounter = 0;

  const filteredData = computed(() => {
    if (advancedFilters.value.length === 0) return records.value;

    return records.value.filter((record) => {
      let result = true;
      let firstFilter = true;

      for (const filter of advancedFilters.value) {
        let cellValue: unknown;
        if (filter.columnId === "key") {
          cellValue = record.key;
        } else if (filter.columnId === "value") {
          cellValue = record.value;
        } else {
          cellValue = (record.value as Record<string, unknown>)?.[filter.columnId];
        }

        const match = matchesFilter(cellValue, filter.operator, filter.value);

        if (firstFilter) {
          result = match;
          firstFilter = false;
        } else if (filter.logic === "and") {
          result = result && match;
        } else {
          result = result || match;
        }
      }

      return result;
    });
  });

  function getOperator(op: FilterOperator) {
    return OPERATORS.find((o) => o.value === op)!;
  }

  function addFilter(columnId = "key") {
    advancedFilters.value.push({
      id: `adv-${filterIdCounter++}`,
      columnId,
      operator: "contains",
      value: "",
      logic: "and",
    });
  }

  function addFilterFull(filter: Omit<AdvancedFilter, "id">) {
    advancedFilters.value.push({
      ...filter,
      id: `adv-${filterIdCounter++}`,
    });
  }

  function removeFilter(id: string) {
    const idx = advancedFilters.value.findIndex((f) => f.id === id);
    if (idx >= 0) advancedFilters.value.splice(idx, 1);
  }

  function clearAdvancedFilters() {
    advancedFilters.value.length = 0;
  }

  function reset() {
    advancedFilters.value = [];
  }

  return {
    advancedFilters,
    filteredData,
    getOperator,
    addFilter,
    addFilterFull,
    removeFilter,
    clearAdvancedFilters,
    reset,
  };
}
