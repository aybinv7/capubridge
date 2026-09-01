export type StorageGraphStorageKind = "indexeddb" | "localforage" | "sqlite";

export type StorageGraphEntityKind = "indexeddb-store" | "localforage-entry" | "sqlite-table";

export type StorageGraphFieldKind =
  | "key-path"
  | "index"
  | "column"
  | "foreign-key"
  | "sample-field"
  | "entry-key";

export type StorageGraphEdgeKind = "foreign-key" | "logical-reference" | "field-match" | "manual";

export type StorageGraphConfidence = "high" | "medium" | "low";

export interface StorageGraphPosition {
  x: number;
  y: number;
}

export interface StorageGraphFieldReference {
  targetNodeId: string;
  targetFieldName?: string;
  relationshipKind?: "foreign-key" | "logical-reference";
}

export interface StorageGraphField {
  id: string;
  name: string;
  normalizedName: string;
  kind: StorageGraphFieldKind;
  valueType?: string;
  isPrimary?: boolean;
  isIndexed?: boolean;
  isForeignKey?: boolean;
  references?: StorageGraphFieldReference;
}

export interface StorageGraphNodeAnnotation {
  label?: string;
  note?: string;
  accent?: string;
}

export interface StorageGraphGroupRecord {
  id: string;
  nodeIds: string[];
}

export interface StorageGraphEntityNodeData {
  nodeKind: "entity";
  entityKind: StorageGraphEntityKind;
  storageKind: StorageGraphStorageKind;
  groupKey: string;
  title: string;
  subtitle: string;
  containerLabel: string;
  openPath: string;
  statsLabel?: string;
  changeCount: number;
  fields: StorageGraphField[];
  annotation?: StorageGraphNodeAnnotation;
}

export interface StorageGraphNoteNodeData {
  nodeKind: "note";
  title: string;
  note: string;
  accent: string;
}

export interface StorageGraphGroupFrameNodeData {
  nodeKind: "group-frame";
  title: string;
  width: number;
  height: number;
  variant?: "container" | "relationship" | "inferred" | "manual";
  memberIds?: string[];
  clusterSource?: "inferred" | "manual";
}

export interface StorageGraphClusterSelection {
  id: string;
  name: string;
  note?: string;
  memberIds: string[];
  memberNames: string[];
  source: "inferred" | "manual";
}

export interface StorageGraphRelatedTable {
  relationshipId: string;
  nodeId: string;
  title: string;
  direction: "incoming" | "outgoing";
  kind: StorageGraphEdgeKind;
  confidence: StorageGraphConfidence;
  sourceFieldName?: string;
  targetFieldName?: string;
}

export type StorageGraphNodeData =
  | StorageGraphEntityNodeData
  | StorageGraphNoteNodeData
  | StorageGraphGroupFrameNodeData;

export interface StorageGraphEntityDescriptor {
  id: string;
  storageKind: StorageGraphStorageKind;
  entityKind: StorageGraphEntityKind;
  title: string;
  subtitle: string;
  containerLabel: string;
  openPath: string;
  statsLabel?: string;
  groupKey: string;
  changeCount: number;
  fields: StorageGraphField[];
  annotation?: StorageGraphNodeAnnotation;
}

export interface StorageGraphRelationship {
  id: string;
  kind: StorageGraphEdgeKind;
  source: string;
  target: string;
  label: string;
  confidence: StorageGraphConfidence;
  sourceFieldName?: string;
  targetFieldName?: string;
  userDefined?: boolean;
  routePoints?: StorageGraphPosition[];
}

export interface StorageGraphManualEdgeRecord {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface StorageGraphNoteRecord {
  id: string;
  title: string;
  note: string;
  accent: string;
  position: StorageGraphPosition;
}

export interface StorageGraphPersistedScope {
  positions: Record<string, StorageGraphPosition>;
  notes: StorageGraphNoteRecord[];
  manualEdges: StorageGraphManualEdgeRecord[];
  annotations: Record<string, StorageGraphNodeAnnotation>;
  groups: StorageGraphGroupRecord[];
}
