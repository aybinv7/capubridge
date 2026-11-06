import type { CacheStorageCatalog } from "@capubridge/cdp-protocol";
import type { DataSection, DataSelection } from "@/modules/storage/frame/dataFrame.types";
import type { SourceSettings } from "@/modules/storage/frame/useDataSidebarSettings";

/** The host of an origin, for quiet labels. */
export function hostOf(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

/**
 * The cache the route points at. `null` while the caches are not known, or when none is asked
 * for (the overview shows); `missing` when the asked cache is not on the page.
 */
export function resolveCache(
  asked: string,
  catalog: CacheStorageCatalog | undefined,
): { cache: string | null; missing: string | null } {
  if (!asked || !catalog) return { cache: null, missing: null };
  if (catalog.caches.some((entry) => entry.name === asked)) return { cache: asked, missing: null };
  return { cache: null, missing: `“${asked}” is not in this page's Cache storage any more.` };
}

export function selectionOf(origin: string, cache: string | null): DataSelection | null {
  return origin ? { sourceId: origin, collectionId: cache } : null;
}

export interface CacheTreeInput {
  catalog: CacheStorageCatalog | undefined;
  settings: (sourceId: string) => SourceSettings;
  open: string | null;
  /** Entries in the open cache, from its own read (fresher than the catalog). */
  openCount: number | null;
}

/** One source, the page's origin, with its caches. */
export function buildCacheSections(input: CacheTreeInput): DataSection[] {
  const catalog = input.catalog;
  if (!catalog) return [];
  if (!catalog.available) {
    return [
      {
        id: "cache",
        label: "Cache storage",
        sources: [],
        empty: "This page has no Cache storage: it needs a secure page (https or localhost).",
      },
    ];
  }
  const settings = input.settings(catalog.origin);
  return [
    {
      id: "cache",
      label: "Cache storage",
      sources: [
        {
          id: catalog.origin,
          label: "This page",
          detail: hostOf(catalog.origin),
          provenance: "live",
          expanded: settings.expanded,
          pinned: settings.pinned,
          hidden: settings.hidden,
          collections: catalog.caches.map((entry) => {
            const count =
              input.open === entry.name && input.openCount !== null ? input.openCount : entry.count;
            return {
              id: entry.name,
              label: entry.name,
              ...(typeof count === "number" ? { count } : {}),
              pinned: settings.pinnedItems.includes(entry.name),
              hidden: settings.hiddenItems.includes(entry.name),
            };
          }),
          ...(catalog.caches.length === 0 ? { note: "No caches yet" } : {}),
        },
      ],
    },
  ];
}
