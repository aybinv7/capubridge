import type { NetworkTypeFilter } from "@/types/network.types";
import type { RequestSortKey } from "./requestSort";

export type RequestColumnId =
  | "name"
  | "status"
  | "type"
  | "initiator"
  | "size"
  | "time"
  | "waterfall";

export interface RequestColumn {
  id: RequestColumnId;
  label: string;
  sortKey: RequestSortKey;
  /** Width and alignment of the cell, shared by the header and every row. */
  className: string;
  /** Classes that show the cell from a container width up; the column hides below it. */
  showAt?: string;
  align: "start" | "end";
}

/** Row height in pixels: the roomy row of the density scale, one line per request. */
export const REQUEST_ROW_HEIGHT = 30;

export const REQUEST_COLUMNS: readonly RequestColumn[] = [
  { id: "name", label: "Name", sortKey: "name", className: "min-w-0 flex-1", align: "start" },
  { id: "status", label: "Status", sortKey: "status", className: "w-20 shrink-0", align: "start" },
  {
    id: "type",
    label: "Type",
    sortKey: "type",
    className: "w-20 shrink-0",
    showAt: "@2xl:flex",
    align: "start",
  },
  {
    id: "initiator",
    label: "Initiator",
    sortKey: "initiator",
    className: "w-36 shrink-0",
    showAt: "@5xl:flex",
    align: "start",
  },
  {
    id: "size",
    label: "Size",
    sortKey: "size",
    className: "w-32 shrink-0 justify-end",
    showAt: "@lg:flex",
    align: "end",
  },
  {
    id: "time",
    label: "Time",
    sortKey: "time",
    className: "w-18 shrink-0 justify-end",
    align: "end",
  },
  {
    id: "waterfall",
    label: "Waterfall",
    sortKey: "start",
    className: "w-[24%] min-w-32 shrink-0",
    showAt: "@3xl:flex",
    align: "start",
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
  waterfall: boolean;
  typeFilter: NetworkTypeFilter;
}

/**
 * Which optional columns are on. Type is off while the type filter keeps a single type, since
 * every row would repeat the selected segment; filters that mix types (Fetch/XHR, Other) keep it.
 */
export function columnVisibility(
  context: ColumnContext,
): Partial<Record<RequestColumnId, boolean>> {
  return {
    waterfall: context.waterfall,
    type: !SINGLE_TYPE_FILTERS.has(context.typeFilter),
  };
}

/** The display classes of a column: always shown, or shown from its container width up. */
export function columnDisplay(column: RequestColumn): string {
  return column.showAt ? `hidden ${column.showAt}` : "flex";
}
