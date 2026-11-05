import type { RequestSortKey } from "./requestSort";

export type RequestColumnId =
  | "method"
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
  /** Width and alignment of the cell. */
  className: string;
  /** Classes that show the cell from a container width up; the column hides below it. */
  showAt?: string;
  align: "start" | "end";
}

/** Row height in pixels: the default row of the density scale. */
export const REQUEST_ROW_HEIGHT = 26;

export const REQUEST_COLUMNS: readonly RequestColumn[] = [
  { id: "method", label: "Method", sortKey: "method", className: "w-16 shrink-0", align: "start" },
  { id: "name", label: "Name", sortKey: "name", className: "min-w-0 flex-1", align: "start" },
  { id: "status", label: "Status", sortKey: "status", className: "w-18 shrink-0", align: "start" },
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
    className: "w-32 shrink-0",
    showAt: "@5xl:flex",
    align: "start",
  },
  {
    id: "size",
    label: "Size",
    sortKey: "size",
    className: "w-20 shrink-0 justify-end",
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
    className: "w-[22%] min-w-28 shrink-0",
    showAt: "@3xl:flex",
    align: "start",
  },
];

/** The display classes of a column: always shown, or shown from its container width up. */
export function columnDisplay(column: RequestColumn): string {
  return column.showAt ? `hidden ${column.showAt}` : "flex";
}
