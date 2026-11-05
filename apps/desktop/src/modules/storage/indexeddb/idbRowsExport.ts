import { toast } from "vue-sonner";
import { fileStem, saveFileAs } from "@/lib/download";
import { toCsv, type GridColumn, type GridRow } from "@/shared/components/data/grid";
import type { IDBRecord } from "@capubridge/cdp-protocol";

/**
 * Saves rows from the grid where the person chooses. CSV has the visible columns; JSON has
 * each record as read (key and value, `__type` markers for dates and binary data).
 */
export async function exportRows(options: {
  format: "csv" | "json";
  database: string;
  store: string;
  suffix: string;
  columns: readonly GridColumn[];
  rows: readonly GridRow[];
  records: readonly IDBRecord[];
}): Promise<void> {
  const stem = fileStem(options.database, options.store, options.suffix);
  try {
    const content =
      options.format === "csv"
        ? toCsv(
            options.columns.map((column) => column.title),
            options.rows.map((row) => options.columns.map((column) => row.cells[column.id])),
          )
        : JSON.stringify(
            options.records.map((record) => ({
              key: record.primaryKey ?? record.key,
              value: record.value,
            })),
            null,
            2,
          );
    const saved = await saveFileAs(content, `${stem}.${options.format}`, [
      options.format === "csv"
        ? { name: "CSV", extensions: ["csv"] }
        : { name: "JSON", extensions: ["json"] },
    ]);
    if (saved) {
      toast.success(`Saved ${options.rows.length.toLocaleString("en-US")} rows`, {
        description: saved,
      });
    }
  } catch (error) {
    toast.error("Could not save the rows", { description: String(error) });
  }
}
