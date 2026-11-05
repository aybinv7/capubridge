export type JsonValueKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export interface JsonRow {
  id: string;
  depth: number;
  key: string | null;
  kind: JsonValueKind;
  preview: string;
  expandable: boolean;
  expanded: boolean;
}

export const ROOT_ID = "$";
const STRING_PREVIEW = 240;

function kindOf(value: unknown): JsonValueKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "null";
}

function childEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.map((item, index) => [String(index), item]);
  if (value !== null && typeof value === "object") return Object.entries(value);
  return [];
}

function childCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** What a value reads as on its row: a quoted string, a number, or the size of a container. */
export function jsonPreview(value: unknown): string {
  const kind = kindOf(value);
  if (kind === "array") return `[ ${plural(childCount(value), "item")} ]`;
  if (kind === "object") return `{ ${plural(childCount(value), "key")} }`;
  if (kind === "string") {
    const text = value as string;
    const cut = text.length > STRING_PREVIEW ? `${text.slice(0, STRING_PREVIEW)}…` : text;
    return JSON.stringify(cut);
  }
  return String(value);
}

function childId(parent: string, key: string): string {
  return `${parent}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

/**
 * The visible rows of a JSON tree, depth first, skipping the children of collapsed containers.
 * Iterative, so deep documents cannot overflow the stack.
 */
export function jsonRows(value: unknown, expanded: ReadonlySet<string>): JsonRow[] {
  const rows: JsonRow[] = [];
  const stack: Array<{ id: string; key: string | null; value: unknown; depth: number }> = [
    { id: ROOT_ID, key: null, value, depth: 0 },
  ];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    const kind = kindOf(node.value);
    const expandable = childCount(node.value) > 0;
    const isOpen = expandable && expanded.has(node.id);
    rows.push({
      id: node.id,
      depth: node.depth,
      key: node.key,
      kind,
      preview: jsonPreview(node.value),
      expandable,
      expanded: isOpen,
    });
    if (!isOpen) continue;
    const children = childEntries(node.value);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (!child) continue;
      stack.push({
        id: childId(node.id, child[0]),
        key: child[0],
        value: child[1],
        depth: node.depth + 1,
      });
    }
  }
  return rows;
}

/** The ids of every container down to `depth` levels, the tree's opening state. */
export function expandedToDepth(value: unknown, depth: number): Set<string> {
  const ids = new Set<string>();
  const queue: Array<{ id: string; value: unknown; depth: number }> = [
    { id: ROOT_ID, value, depth: 0 },
  ];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    if (!node || node.depth >= depth || childCount(node.value) === 0) continue;
    ids.add(node.id);
    if (node.depth + 1 >= depth) continue;
    for (const [key, child] of childEntries(node.value)) {
      queue.push({ id: childId(node.id, key), value: child, depth: node.depth + 1 });
    }
  }
  return ids;
}
