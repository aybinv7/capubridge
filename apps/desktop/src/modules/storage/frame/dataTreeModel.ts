import { compareText } from "@/shared/format/collator";
import type {
  DataCollectionNode,
  DataSection,
  DataSourceNode,
  DataTreeRow,
} from "./dataFrame.types";

export interface DataTreeOptions {
  search: string;
  showHidden: boolean;
}

export interface DataTreeModel {
  rows: DataTreeRow[];
  hiddenSources: number;
  hiddenCollections: number;
  /** A search is typed and nothing matched it. */
  noMatch: boolean;
}

function byPinThenName<T extends { pinned?: boolean; label: string }>(left: T, right: T): number {
  const pin = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
  return pin !== 0 ? pin : compareText(left.label, right.label);
}

/**
 * An ordered list (a folder tree) keeps its order, but pinned entries move to the top, out of
 * their place in the tree, without indentation.
 */
function pinnedFirst(list: DataCollectionNode[]): DataCollectionNode[] {
  const pinned = list.filter((collection) => collection.pinned);
  if (pinned.length === 0) return list;
  return [
    ...pinned.map((collection) => ({ ...collection, depth: 0 })),
    ...list.filter((collection) => !collection.pinned),
  ];
}

function visibleCollections(
  source: DataSourceNode,
  needle: string,
  showHidden: boolean,
): { collections: DataCollectionNode[]; matched: boolean } {
  const kept = source.collections.filter((collection) => showHidden || !collection.hidden);
  const order = (list: DataCollectionNode[]) =>
    source.ordered ? pinnedFirst(list) : list.sort(byPinThenName);
  if (!needle) return { collections: order(kept), matched: true };
  const matching = kept.filter((collection) => collection.label.toLowerCase().includes(needle));
  if (matching.length > 0) return { collections: order(matching), matched: true };
  const sourceMatches = source.label.toLowerCase().includes(needle);
  return { collections: sourceMatches ? order(kept) : [], matched: sourceMatches };
}

/**
 * Flattens sections → sources → collections into the rows the sidebar renders, applying
 * the search, pins (first) and hidden entries. Pure, so the tree is computed once per change
 * instead of per row in the template.
 */
export function buildDataTree(
  sections: readonly DataSection[],
  options: DataTreeOptions,
): DataTreeModel {
  const needle = options.search.trim().toLowerCase();
  const rows: DataTreeRow[] = [];
  let hiddenSources = 0;
  let hiddenCollections = 0;
  let anyMatch = false;
  const labelled = sections.filter((section) => section.sources.length > 0 || section.empty);
  const showHeadings = labelled.length > 1;

  for (const section of labelled) {
    const sectionRows: DataTreeRow[] = [];
    const sources = [...section.sources].sort(byPinThenName);
    for (const source of sources) {
      hiddenCollections += source.collections.filter((collection) => collection.hidden).length;
      if (source.hidden) hiddenSources += 1;
      if (source.hidden && !options.showHidden) continue;
      const { collections, matched } = visibleCollections(source, needle, options.showHidden);
      if (!matched) continue;
      anyMatch = true;
      const expanded = needle ? true : source.expanded;
      sectionRows.push({ kind: "source", key: `s:${source.id}`, source, sectionId: section.id });
      if (!expanded) continue;
      if (source.note) {
        sectionRows.push({
          kind: "note",
          key: `sn:${source.id}`,
          text: source.note,
          sectionId: section.id,
        });
      }
      if (source.link) {
        sectionRows.push({
          kind: "link",
          key: `l:${source.id}`,
          source,
          link: source.link,
          sectionId: section.id,
        });
      }
      const grouped = source.groupPinned && !needle && collections.some((entry) => entry.pinned);
      collections.forEach((collection, index) => {
        if (grouped && index === 0) {
          sectionRows.push({
            kind: "note",
            key: `gp:${source.id}`,
            text: "Pinned",
            sectionId: section.id,
          });
        }
        if (grouped && !collection.pinned && collections[index - 1]?.pinned) {
          sectionRows.push({
            kind: "note",
            key: `gt:${source.id}`,
            text: `${source.collectionsLabel ?? "Collections"} (${collections.length})`,
            sectionId: section.id,
          });
        }
        sectionRows.push({
          kind: "collection",
          key: `c:${source.id}\u0000${collection.id}`,
          source,
          collection,
          sectionId: section.id,
        });
      });
    }
    if (needle && sectionRows.length === 0) continue;
    if (showHeadings) rows.push({ kind: "section", key: `h:${section.id}`, section });
    if (sectionRows.length === 0 && section.empty) {
      rows.push({
        kind: "note",
        key: `n:${section.id}`,
        text: section.empty,
        sectionId: section.id,
      });
    }
    rows.push(...sectionRows);
  }

  return { rows, hiddenSources, hiddenCollections, noMatch: Boolean(needle) && !anyMatch };
}

/** Whether a tree row can take keyboard focus (headings and notes cannot). */
export function isFocusableRow(row: DataTreeRow): boolean {
  return row.kind === "source" || row.kind === "collection" || row.kind === "link";
}
