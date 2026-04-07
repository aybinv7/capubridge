import type { Table } from "@tanstack/vue-table";
import type { IDBRecord } from "utils";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useIDBTableExport(
  table: Table<IDBRecord>,
  dbName: () => string,
  storeName: () => string,
) {
  function exportToCSV() {
    const visibleColumns = table.getVisibleFlatColumns();
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
    downloadFile(csv, `${dbName()}_${storeName()}.csv`, "text/csv");
  }

  function exportToJSON() {
    const rows = table.getFilteredRowModel().rows.map((row) => row.original);
    const json = JSON.stringify(rows, null, 2);
    downloadFile(json, `${dbName()}_${storeName()}.json`, "application/json");
  }

  function exportSelectedToJSON() {
    const rows = table.getSelectedRowModel().rows.map((row) => row.original);
    const json = JSON.stringify(rows, null, 2);
    downloadFile(json, `${dbName()}_${storeName()}_selected.json`, "application/json");
  }

  return { exportToCSV, exportToJSON, exportSelectedToJSON };
}
