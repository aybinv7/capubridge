import type { NetworkTypeFilter } from "@/types/network.types";
import type { ListColumn } from "../columns/listColumns";
import type { RequestSortKey } from "./requestSort";

export type RequestColumnId =
  | "method"
  | "status"
  | "name"
  | "path"
  | "host"
  | "type"
  | "initiator"
  | "size"
  | "time"
  | "waterfall";

export interface RequestColumn extends ListColumn<RequestColumnId> {
  sortKey: RequestSortKey;
}

/** Row height in pixels: the roomy row of the density scale, one line per request. */
export const REQUEST_ROW_HEIGHT = 30;

/**
 * The request list's columns, each fact in its own. Name takes the room the others leave; when
 * the list narrows, Initiator steps aside first, then the waterfall, Path, Host, Type and Size.
 * Method, Status, Name and Time always stay.
 */
export const REQUEST_COLUMNS: readonly RequestColumn[] = [
  { id: "method", label: "Method", sortKey: "method", width: 68, minWidth: 52, align: "start" },
  { id: "status", label: "Status", sortKey: "status", width: 80, minWidth: 56, align: "start" },
  {
    id: "name",
    label: "Name",
    sortKey: "name",
    width: 0,
    minWidth: 140,
    flex: true,
    align: "start",
  },
  {
    id: "path",
    label: "Path",
    sortKey: "path",
    width: 160,
    minWidth: 64,
    align: "start",
    dropOrder: 3,
  },
  {
    id: "host",
    label: "Host",
    sortKey: "host",
    width: 168,
    minWidth: 64,
    align: "start",
    dropOrder: 4,
  },
  {
    id: "type",
    label: "Type",
    sortKey: "type",
    width: 88,
    minWidth: 56,
    align: "start",
    dropOrder: 5,
  },
  {
    id: "initiator",
    label: "Initiator",
    sortKey: "initiator",
    width: 140,
    minWidth: 64,
    align: "start",
    dropOrder: 1,
  },
  {
    id: "size",
    label: "Size",
    sortKey: "size",
    width: 120,
    minWidth: 64,
    align: "end",
    dropOrder: 6,
  },
  { id: "time", label: "Time", sortKey: "time", width: 80, minWidth: 64, align: "end" },
  {
    id: "waterfall",
    label: "Waterfall",
    sortKey: "start",
    width: 200,
    minWidth: 96,
    align: "start",
    dropOrder: 2,
  },
];

const SINGLE_TYPE_FILTERS: ReadonlySet<NetworkTypeFilter> = new Set([
  "WS",
  "Doc",
  "Img",
  "Media",
  "Font",
  "Script",
  "Preflight",
]);

export interface ColumnContext {
  /** The waterfall steps aside while the details pane takes the width. */
  detailsOpen: boolean;
  typeFilter: NetworkTypeFilter;
}

/**
 * Columns the context hides for now, with the reason the Columns menu gives. Type steps aside
 * while the type filter keeps a single type, since every row would repeat the selected segment;
 * filters that mix types (Fetch/XHR, Other) keep it.
 */
export function hiddenByContext(context: ColumnContext): Partial<Record<RequestColumnId, string>> {
  const hidden: Partial<Record<RequestColumnId, string>> = {};
  if (context.detailsOpen) hidden.waterfall = "While details are open";
  if (SINGLE_TYPE_FILTERS.has(context.typeFilter)) hidden.type = "One type is filtered";
  return hidden;
}
