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
  /** Width and alignment of the cell. */
  className: string;
  /** Classes that show the cell from a container width up; the column hides below it. */
  showAt?: string;
  align: "start" | "end";
}

/** Row height in pixels: the default row of the density scale. */
export const REQUEST_ROW_HEIGHT = 26;

export const REQUEST_COLUMNS: readonly RequestColumn[] = [
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
    className: "w-28 shrink-0 justify-end",
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

/** The columns shown: the waterfall steps aside while the details pane takes the width. */
export function visibleColumns(showWaterfall: boolean): readonly RequestColumn[] {
  return showWaterfall
    ? REQUEST_COLUMNS
    : REQUEST_COLUMNS.filter((column) => column.id !== "waterfall");
}

/** The display classes of a column: always shown, or shown from its container width up. */
export function columnDisplay(column: RequestColumn): string {
  return column.showAt ? `hidden ${column.showAt}` : "flex";
}
