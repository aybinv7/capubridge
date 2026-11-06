import type { LocationQuery, RouteLocationNormalized, RouteParams } from "vue-router";

/** The Data tabs whose place (open list, folder, cache, store) is remembered. */
export const REMEMBERED_TABS = new Set([
  "storage-indexeddb",
  "storage-keyvalue",
  "storage-cache-storage",
  "storage-opfs",
]);

interface Place {
  query: LocationQuery;
  params: RouteParams;
}

function isEmpty(record: Record<string, unknown>): boolean {
  return Object.values(record).every(
    (value) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0),
  );
}

/**
 * Where each Data tab was left, per target: coming back to a tab from elsewhere (another tab,
 * another screen) opens that place again instead of the tab's landing. Opening the landing on
 * purpose from inside the tab is never undone.
 */
export function createDataPlaces() {
  const places = new Map<string, Place>();

  function keyOf(target: string, name: string): string {
    return `${target}\u0000${name}`;
  }

  function remember(target: string, to: RouteLocationNormalized) {
    const name = typeof to.name === "string" ? to.name : "";
    if (!target || !REMEMBERED_TABS.has(name)) return;
    places.set(keyOf(target, name), { query: { ...to.query }, params: { ...to.params } });
  }

  /** The place to open instead of `to`, or `null` to go where asked. */
  function restore(
    target: string,
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
  ): { name: string; query: LocationQuery; params: RouteParams } | null {
    const name = typeof to.name === "string" ? to.name : "";
    if (!target || !REMEMBERED_TABS.has(name) || from.name === name) return null;
    if (!isEmpty(to.query) || !isEmpty(to.params)) return null;
    const place = places.get(keyOf(target, name));
    if (!place || (isEmpty(place.query) && isEmpty(place.params))) return null;
    return { name, query: place.query, params: place.params };
  }

  return { remember, restore };
}
