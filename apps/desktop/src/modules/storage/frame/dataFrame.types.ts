import type { Component } from "vue";
import type { Provenance } from "@/lib/provenance";

export type DataKind = "indexeddb" | "keyvalue" | "cache" | "opfs" | "sqlite";

/** Where the rows on screen came from. */
export type DataProvenance = Extract<Provenance, "live" | "local" | "imported" | "stale">;

/** Device changes seen while a source was watched. */
export interface DataChangeCounts {
  add: number;
  update: number;
  delete: number;
  total: number;
}

/** One action in a sidebar row menu or a header menu. */
export interface DataAction {
  id: string;
  label: string;
  icon?: Component;
  danger?: boolean;
  disabled?: boolean;
  /** Why the action is disabled, shown as its hint. */
  reason?: string;
  separatorBefore?: boolean;
}

/** A link a source row carries instead of collections (e.g. a database another tab owns). */
export interface DataSourceLink {
  label: string;
  to: string;
}

export interface DataCollectionNode {
  id: string;
  label: string;
  count?: number;
  changes?: DataChangeCounts;
  pinned?: boolean;
  hidden?: boolean;
}

export interface DataSourceNode {
  id: string;
  label: string;
  /** Quiet trailing detail, e.g. `v3`. */
  detail?: string;
  provenance: DataProvenance;
  collections: readonly DataCollectionNode[];
  changes?: DataChangeCounts;
  pinned?: boolean;
  hidden?: boolean;
  expanded: boolean;
  link?: DataSourceLink;
}

export interface DataSection {
  id: string;
  label: string;
  sources: readonly DataSourceNode[];
  /** Shown under the heading when the section has no sources. */
  empty?: string;
}

/** The current place in the tree: a source, and optionally one of its collections. */
export interface DataSelection {
  sourceId: string;
  collectionId: string | null;
}

/** One rendered line of the flattened tree. */
export type DataTreeRow =
  | { kind: "section"; key: string; section: DataSection }
  | { kind: "source"; key: string; source: DataSourceNode; sectionId: string }
  | {
      kind: "collection";
      key: string;
      source: DataSourceNode;
      collection: DataCollectionNode;
      sectionId: string;
    }
  | { kind: "link"; key: string; source: DataSourceNode; link: DataSourceLink; sectionId: string }
  | { kind: "note"; key: string; text: string; sectionId: string };
