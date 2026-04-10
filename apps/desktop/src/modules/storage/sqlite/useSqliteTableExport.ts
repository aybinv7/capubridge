import { toast } from "vue-sonner";
import type { Table } from "@tanstack/vue-table";
import type { RowRecord } from "./useSqliteAdvancedFilters";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useSqliteTableExport(
  table: Table<RowRecord>,
  dbName: () => string,
  tableName: () => string,
) {
  function exportToCSV() {
    const visibleColumns = table.getVisibleFlatColumns().filter((c) => c.id !== "__select");
    const rows = table.getFilteredRowModel().rows;

    const header = visibleColumns.map((col) => `"${col.id}"`).join(",");
    const dataRows = rows.map((row) =>
      visibleColumns
        .map((col) => {
          const cell = row.getValue(col.id);
          const str =
            cell === null || cell === undefined
              ? ""
              : typeof cell === "object"
                ? JSON.stringify(cell)
                : String(cell);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(","),
    );

    const csv = [header, ...dataRows].join("\n");
    downloadFile(csv, `${dbName()}_${tableName()}.csv`, "text/csv");
    toast.success("Exported to CSV", { description: `${rows.length} rows exported` });
  }

  function exportToJSON() {
    const rows = table.getFilteredRowModel().rows.map((row) => row.original);
    const json = JSON.stringify(rows, null, 2);
    downloadFile(json, `${dbName()}_${tableName()}.json`, "application/json");
    toast.success("Exported to JSON", { description: `${rows.length} records exported` });
  }

  function exportSelectedToJSON() {
    const rows = table.getSelectedRowModel().rows.map((row) => row.original);
    const json = JSON.stringify(rows, null, 2);
    downloadFile(json, `${dbName()}_${tableName()}_selected.json`, "application/json");
    toast.success("Exported selected to JSON", { description: `${rows.length} records exported` });
  }

  return { exportToCSV, exportToJSON, exportSelectedToJSON };
}
