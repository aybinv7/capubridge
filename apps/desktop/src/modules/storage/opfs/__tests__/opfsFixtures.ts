import type { OPFSItem, StorageTechHint } from "@capubridge/cdp-protocol";
import { toRows, type OpfsRow } from "../opfsModel";

export function file(path: string, size = 10, extra: Partial<OPFSItem> = {}): OPFSItem {
  const name = path.split("/").pop() ?? path;
  return { name, path, kind: "file", size, lastModified: 1000, ...extra };
}

export function folder(path: string): OPFSItem {
  const name = path.split("/").pop() ?? path;
  return { name, path, kind: "directory", size: null, lastModified: null };
}

export function rowsOf(items: OPFSItem[], hints: StorageTechHint[] = []): OpfsRow[] {
  return toRows(items, hints);
}

export function row(item: OPFSItem, hints: StorageTechHint[] = []): OpfsRow {
  const [built] = toRows([item], hints);
  if (!built) throw new Error("no row");
  return built;
}

export function poolHint(names: string[]): StorageTechHint {
  return {
    id: "sqlite-wasm-sah-pool",
    label: "SQLite WASM — SAH-Pool",
    description: "",
    confidence: "high",
    evidence: [],
    affectedEntries: names,
    inspectable: true,
  };
}
