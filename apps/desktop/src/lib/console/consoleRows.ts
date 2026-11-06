import type { RingBuffer } from "@/lib/ring-buffer";
import type { ConsoleEntry, ConsoleEntryLevel } from "@/types/console.types";

export type ConsoleFilterLevel = ConsoleEntryLevel | "all" | "verbose";

export interface ConsoleRow {
  entry: ConsoleEntry;
  depth: number;
}

export interface ConsoleRowOptions {
  query: string;
  level: ConsoleFilterLevel;
  isExpanded(entry: ConsoleEntry): boolean;
}

const searchTexts = new WeakMap<ConsoleEntry, string>();

/** The lowercased text the console filter searches, built once per entry on first use. */
export function consoleSearchText(entry: ConsoleEntry): string {
  let text = searchTexts.get(entry);
  if (text === undefined) {
    text = `${entry.source} ${entry.message}`.toLowerCase();
    searchTexts.set(entry, text);
  }
  return text;
}

function levelMatches(entry: ConsoleEntry, level: ConsoleFilterLevel): boolean {
  if (level === "all") return true;
  if (level === "verbose") return entry.level === "log" || entry.level === "debug";
  return entry.level === level;
}

/**
 * The console rows to show, in order, with group depth. A filter keeps the groups on the path
 * to a match. One pass over the buffer; groups only cost a child index when there are any.
 */
export function buildConsoleRows(
  ring: RingBuffer<ConsoleEntry>,
  options: ConsoleRowOptions,
): ConsoleRow[] {
  const query = options.query.trim().toLowerCase();
  const filterActive = query !== "" || options.level !== "all";
  const children = new Map<string, ConsoleEntry[]>();
  const roots: ConsoleEntry[] = [];
  const shown = filterActive ? new Set<string>() : null;
  const ordered: ConsoleEntry[] = [];

  const presentGroups = new Set<string>();
  ring.forEach((entry) => {
    ordered.push(entry);
    if (entry.isGroup) presentGroups.add(entry.id);
    if (entry.parentId && entry.parentId !== entry.id && presentGroups.has(entry.parentId)) {
      const siblings = children.get(entry.parentId);
      if (siblings) siblings.push(entry);
      else children.set(entry.parentId, [entry]);
    } else {
      roots.push(entry);
    }
  });

  if (children.size === 0 && !filterActive) {
    return ordered.map((entry) => ({ entry, depth: 0 }));
  }

  if (shown) {
    const byId = new Map<string, ConsoleEntry>();
    for (const entry of ordered) {
      if (entry.isGroup) byId.set(entry.id, entry);
    }
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const entry = ordered[index];
      if (!entry) continue;
      const matches =
        shown.has(entry.id) ||
        (levelMatches(entry, options.level) &&
          (!query || consoleSearchText(entry).includes(query)));
      if (!matches) continue;
      shown.add(entry.id);
      let parentId = entry.parentId;
      while (parentId && !shown.has(parentId) && byId.has(parentId)) {
        shown.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
  }

  const rows: ConsoleRow[] = [];
  const visited = new Set<string>();
  const stack: ConsoleRow[] = [];
  for (let index = roots.length - 1; index >= 0; index -= 1) {
    const root = roots[index];
    if (root) stack.push({ entry: root, depth: 0 });
  }
  while (stack.length > 0) {
    const row = stack.pop();
    if (!row || visited.has(row.entry.id)) continue;
    visited.add(row.entry.id);
    if (shown && !shown.has(row.entry.id)) continue;
    rows.push(row);
    if (!row.entry.isGroup || !options.isExpanded(row.entry)) continue;
    const kids = children.get(row.entry.id) ?? [];
    for (let index = kids.length - 1; index >= 0; index -= 1) {
      const kid = kids[index];
      if (kid) stack.push({ entry: kid, depth: row.depth + 1 });
    }
  }
  return rows;
}
