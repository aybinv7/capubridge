import type { KeyValueDiscovery } from "@capubridge/cdp-protocol";
import type {
  DataCollectionNode,
  DataSection,
  DataSelection,
  DataSourceNode,
} from "@/modules/storage/frame/dataFrame.types";
import type { SourceSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import { makeSource, type KvSource, type KvSourceKind } from "./kvModel";

const FORAGE_PREFIX = "forage:";
const DEFAULT_FORAGE_DB = "localforage";
const DEFAULT_FORAGE_STORE = "keyvaluepairs";

/** What the route asks for: `?origin=&source=local|session|forage&db=&store=`. */
export interface KvLocationQuery {
  origin: string;
  source: string;
  database: string;
  store: string;
}

/** The sidebar collection id of a list inside an origin. */
export function collectionIdOf(source: KvSource): string {
  if (source.kind !== "forage") return source.kind;
  return `${FORAGE_PREFIX}${JSON.stringify([source.database ?? "", source.store ?? ""])}`;
}

/** The list a sidebar row stands for. */
export function sourceFromSelection(origin: string, collectionId: string): KvSource | null {
  if (collectionId === "local" || collectionId === "session") {
    return makeSource({ kind: collectionId, origin });
  }
  if (!collectionId.startsWith(FORAGE_PREFIX)) return null;
  try {
    const [database, store] = JSON.parse(collectionId.slice(FORAGE_PREFIX.length)) as unknown[];
    if (typeof database !== "string" || typeof store !== "string") return null;
    return makeSource({ kind: "forage", origin, database, store });
  } catch {
    return null;
  }
}

export function selectionOf(source: KvSource | null): DataSelection | null {
  return source ? { sourceId: source.origin, collectionId: collectionIdOf(source) } : null;
}

/** How a LocalForage store is named: the default instance is just "LocalForage". */
export function forageLabel(database: string, store: string): string {
  if (store === DEFAULT_FORAGE_STORE) {
    return database === DEFAULT_FORAGE_DB ? "LocalForage" : `LocalForage “${database}”`;
  }
  return database === DEFAULT_FORAGE_DB
    ? `LocalForage › ${store}`
    : `LocalForage “${database}” › ${store}`;
}

const KIND_LABEL: Record<Exclude<KvSourceKind, "forage">, string> = {
  local: "Local storage",
  session: "Session storage",
};

/** The heading of a list, as the sidebar and the header name it. */
export function sourceLabel(source: KvSource): string {
  if (source.kind === "forage") return forageLabel(source.database ?? "", source.store ?? "");
  return KIND_LABEL[source.kind];
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

/** The page's own origin reads "This page"; a frame's origin reads as its host. */
export function originLabel(origin: string, pageOrigin: string): { label: string; detail: string } {
  if (origin === pageOrigin) return { label: "This page", detail: hostOf(origin) };
  return { label: hostOf(origin), detail: "frame" };
}

/**
 * The list the route points at, with defaults: the page origin, then Local storage; a
 * LocalForage link without a store opens the first store of that database (or any). `null`
 * while nothing is known yet; `missing` when the origin or store is not on the page.
 */
export function resolveSource(
  query: KvLocationQuery,
  discovery: KeyValueDiscovery | undefined,
): { source: KvSource | null; missing: string | null } {
  if (!discovery) {
    if (!query.origin) return { source: null, missing: null };
    if (query.source === "local" || query.source === "session") {
      return { source: makeSource({ kind: query.source, origin: query.origin }), missing: null };
    }
    if (query.source === "forage" && query.database && query.store) {
      return {
        source: makeSource({
          kind: "forage",
          origin: query.origin,
          database: query.database,
          store: query.store,
        }),
        missing: null,
      };
    }
    return { source: null, missing: null };
  }
  const origin = query.origin || discovery.pageOrigin;
  if (!discovery.origins.includes(origin)) {
    return { source: null, missing: `${origin} is not on this page any more.` };
  }
  if (query.source !== "forage") {
    const kind = query.source === "session" ? "session" : "local";
    return { source: makeSource({ kind, origin }), missing: null };
  }
  const stores = origin === discovery.pageOrigin ? discovery.forage : [];
  const match =
    stores.find(
      (entry) => entry.database === query.database && (!query.store || entry.store === query.store),
    ) ?? (query.database ? undefined : stores[0]);
  if (!match) {
    const name = query.database
      ? forageLabel(query.database, query.store || DEFAULT_FORAGE_STORE)
      : "LocalForage";
    return { source: null, missing: `${name} is not on this page.` };
  }
  return {
    source: makeSource({
      kind: "forage",
      origin,
      database: match.database,
      store: match.store,
    }),
    missing: null,
  };
}

/** The route query of a list. */
export function queryOf(source: KvSource): Record<string, string> {
  const query: Record<string, string> = { origin: source.origin, source: source.kind };
  if (source.kind === "forage") {
    query["db"] = source.database ?? "";
    query["store"] = source.store ?? "";
  }
  return query;
}

export interface KvTreeInput {
  discovery: KeyValueDiscovery | undefined;
  settings: (sourceId: string) => SourceSettings;
  /** The open list; it shows the count of its own read. */
  open: KvSource | null;
  /** Keys in the open list, from its own read (fresher than discovery). */
  openCount: number | null;
}

function collection(
  source: KvSource,
  count: number | null | undefined,
  settings: SourceSettings,
): DataCollectionNode {
  const id = collectionIdOf(source);
  return {
    id,
    label: sourceLabel(source),
    ...(typeof count === "number" ? { count } : {}),
    pinned: settings.pinnedItems.includes(id),
    hidden: settings.hiddenItems.includes(id),
  };
}

/** One section of origins, each with its Local storage, Session storage and LocalForage stores. */
export function buildKvSections(input: KvTreeInput): DataSection[] {
  const discovery = input.discovery;
  if (!discovery) return [];
  const sources: DataSourceNode[] = discovery.origins.map((origin) => {
    const settings = input.settings(origin);
    const isPage = origin === discovery.pageOrigin;
    const lists: KvSource[] = [
      makeSource({ kind: "local", origin }),
      makeSource({ kind: "session", origin }),
      ...(isPage
        ? discovery.forage.map((entry) =>
            makeSource({
              kind: "forage",
              origin,
              database: entry.database,
              store: entry.store,
            }),
          )
        : []),
    ];
    const countOf = (list: KvSource): number | null | undefined => {
      if (input.open?.id === list.id && input.openCount !== null) return input.openCount;
      if (!isPage) return undefined;
      if (list.kind === "local") return discovery.counts.local;
      if (list.kind === "session") return discovery.counts.session;
      return discovery.forage.find(
        (entry) => entry.database === list.database && entry.store === list.store,
      )?.count;
    };
    const { label, detail } = originLabel(origin, discovery.pageOrigin);
    return {
      id: origin,
      label,
      detail,
      provenance: "live",
      collections: lists.map((list) => collection(list, countOf(list), settings)),
      pinned: settings.pinned,
      hidden: settings.hidden,
      expanded: settings.expanded,
      ...(isPage && discovery.forageError ? { note: discovery.forageError } : {}),
    };
  });
  return [{ id: "keyvalue", label: "Key-value", sources }];
}
