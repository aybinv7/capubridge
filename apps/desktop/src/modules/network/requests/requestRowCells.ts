import type { NetworkEntry } from "@/types/network.types";
import {
  TONE_CLASS,
  initiatorCell,
  sizeCell,
  statusCell,
  timeCell,
  typeWord,
  type CellTone,
} from "./requestCells";
import { requestNameParts } from "./requestNames";

export interface RowCell {
  text: string;
  /** Font and tone only: every cell shares the row's one text size, so all sit on one baseline. */
  className: string;
  title: string | undefined;
}

export interface RowCells {
  method: RowCell;
  status: RowCell;
  name: RowCell;
  /** The folder before the name; it gives way from its start so its end stays in view. */
  path: RowCell;
  host: RowCell;
  type: RowCell;
  initiator: RowCell;
  size: RowCell;
  time: RowCell;
  /** When an open request started, so its time counts up live; `null` once it ended. */
  pendingSince: number | null;
}

/** Reads stay quietest, writes a step up, a delete the strongest neutral: never a hue. */
const METHOD_TONE: Record<string, CellTone> = {
  GET: "subtle",
  HEAD: "subtle",
  OPTIONS: "subtle",
  POST: "muted",
  PUT: "muted",
  PATCH: "muted",
  DELETE: "default",
};

/** The tone of a method word in its column. */
export function methodTone(method: string): CellTone {
  return METHOD_TONE[method] ?? "muted";
}

const cache = new WeakMap<NetworkEntry, RowCells>();

function mono(tone: CellTone): string {
  return `font-mono tabular-nums ${TONE_CLASS[tone]}`;
}

function build(entry: NetworkEntry): RowCells {
  const status = statusCell(entry);
  const size = sizeCell(entry);
  const time = timeCell(entry);
  const initiator = initiatorCell(entry);
  const parts = requestNameParts(entry.url);
  const method = entry.method.toUpperCase();
  return {
    method: {
      text: method,
      className: `font-mono ${TONE_CLASS[methodTone(method)]}`,
      title: undefined,
    },
    status: {
      text: status.text,
      className: mono(status.tone),
      title: status.title ?? (entry.errorText || entry.statusText || undefined),
    },
    name: { text: parts.main, className: "font-mono text-foreground", title: entry.url },
    path: {
      text: parts.path,
      className: "font-mono text-[var(--fg-subtle)]",
      title: parts.path || undefined,
    },
    host: {
      text: parts.host,
      className: "font-mono text-muted-foreground",
      title: parts.host || undefined,
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
    size: { text: size.text, className: mono(size.tone), title: size.title },
    time: { text: time.text, className: mono(time.tone), title: undefined },
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
