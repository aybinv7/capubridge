import type { NetworkEntry } from "@/types/network.types";
import {
  TONE_CLASS,
  initiatorCell,
  sizeCell,
  statusCell,
  timeCell,
  typeWord,
} from "./requestCells";
import { requestNameParts } from "./requestNames";

export interface RowCell {
  text: string;
  /** Font and tone only: every cell shares the row's one text size, so all sit on one baseline. */
  className: string;
  title: string | undefined;
}

export interface RowCells {
  method: string | null;
  name: string;
  detail: string;
  url: string;
  status: RowCell;
  type: RowCell;
  initiator: RowCell;
  size: RowCell;
  time: RowCell;
  /** When an open request started, so its time counts up live; `null` once it ended. */
  pendingSince: number | null;
}

const cache = new WeakMap<NetworkEntry, RowCells>();

function build(entry: NetworkEntry): RowCells {
  const status = statusCell(entry);
  const size = sizeCell(entry);
  const time = timeCell(entry);
  const initiator = initiatorCell(entry);
  const name = requestNameParts(entry.url);
  const method = entry.method.toUpperCase();
  return {
    method: method === "GET" || entry.isWebSocket ? null : method,
    name: name.main,
    detail: name.detail,
    url: entry.url,
    status: {
      text: status.text,
      className: `font-mono tabular-nums ${TONE_CLASS[status.tone]}`,
      title: status.title ?? (entry.errorText || entry.statusText || undefined),
    },
    type: {
      text: typeWord(entry),
      className: "text-muted-foreground",
      title: entry.mimeType || undefined,
    },
    initiator: {
      text: initiator.text,
      className: initiator.isFile ? "font-mono text-[var(--fg-subtle)]" : "text-[var(--fg-subtle)]",
      title: entry.initiatorUrl,
    },
    size: {
      text: size.text,
      className: `font-mono tabular-nums ${TONE_CLASS[size.tone]}`,
      title: size.title,
    },
    time: {
      text: time.text,
      className: `font-mono tabular-nums ${TONE_CLASS[time.tone]}`,
      title: undefined,
    },
    pendingSince:
      entry.state === "pending" && !entry.isWebSocket && entry.finishedTimestamp === null
        ? entry.startedAt
        : null,
  };
}

/** A row's cells, built once per entry object (entries are replaced, never mutated). */
export function rowCells(entry: NetworkEntry): RowCells {
  let cells = cache.get(entry);
  if (!cells) {
    cells = build(entry);
    cache.set(entry, cells);
  }
  return cells;
}
