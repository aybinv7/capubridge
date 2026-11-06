import type { Ref } from "vue";
import { toast } from "@/lib/toast";
import {
  ArrowLeftRight,
  ChartNoAxesGantt,
  Copy,
  EyeOff,
  Filter,
  MapPin,
  RotateCcw,
} from "lucide-vue-next";
import { CONSOLE_QUERY_KEYS } from "@/lib/console/consoleQuery";
import type { ConsoleStreamItem, ConsoleStreamRow } from "@/lib/console/consoleStream";
import { parseQuery } from "@/lib/stream-query/parseQuery";
import { appendTerm, withLevelFloor } from "@/lib/stream-query/queryEdit";
import { formatClockMs } from "@/shared/components/timeline/stripFormat";
import { useDrawerHost } from "@/shared/drawer/toolbarSlot";
import { hasReveal, revealMarker } from "@/shared/timeline/revealRegistry";
import { useTargetsStore } from "@/stores/targets.store";
import { useTimelineStore } from "@/stores/timeline.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { copyText } from "../list/copyText";
import type { RowAction } from "../list/streamView.types";
import { consoleLocation, consoleTone } from "./consoleTone";

const COPY: RowAction = { id: "copy", label: "Copy message", icon: Copy };
const SCRIPT: RowAction = { id: "script", label: "Filter to this script", icon: Filter };
const HIDE_SCRIPT: RowAction = { id: "hide-script", label: "Hide this script", icon: EyeOff };
const LOCATION: RowAction = { id: "location", label: "Copy the location", icon: MapPin };
const REQUEST: RowAction = { id: "request", label: "Open request", icon: ArrowLeftRight };
const RERUN: RowAction = { id: "rerun", label: "Put it back in the prompt", icon: RotateCcw };
const MOMENT: RowAction = {
  id: "moment",
  label: "Show this moment on the timeline",
  icon: ChartNoAxesGantt,
};

function itemText(item: ConsoleStreamItem): string {
  if (item.kind === "entry") return item.entry.message;
  if (item.kind === "exception") {
    return [item.exception.message, ...item.exception.stack.map((line) => `    at ${line}`)].join(
      "\n",
    );
  }
  return item.kind === "input" ? `> ${item.repl.expression}` : `< ${item.repl.result}`;
}

/** Rows as text: time, level and source, then the message, one row per line. */
export function formatConsoleRows(rows: readonly ConsoleStreamRow[]): string {
  return rows
    .map((row) => {
      const tone = consoleTone(row.item);
      const location = consoleLocation(row.item);
      const head = `${formatClockMs(row.item.time)} ${tone.glyph}${location ? ` ${location}` : ""}`;
      const repeat = row.count > 1 ? `  (×${row.count})` : "";
      return `${head} ${itemText(row.item)}${repeat}`;
    })
    .join("\n");
}

function urlOf(item: ConsoleStreamItem): string | null {
  if (item.kind === "entry") return item.entry.url;
  if (item.kind === "exception") return item.exception.url;
  return null;
}

function requestOf(item: ConsoleStreamItem): string | null {
  return item.kind === "entry" ? (item.entry.networkRequestId ?? null) : null;
}

/** What a Console row offers, in its menu and when opened, and what each one does. */
export function useConsoleActions(query: Ref<string>, onRerun: (expression: string) => void) {
  const host = useDrawerHost();
  const targets = useTargetsStore();
  const timeline = useTimelineStore();
  const strip = useTimelineStripStore();

  function edit(key: string, value: string, negate: boolean) {
    query.value = appendTerm(parseQuery(query.value, CONSOLE_QUERY_KEYS), key, value, negate);
  }

  function setFloor(level: string | null) {
    query.value = withLevelFloor(parseQuery(query.value, CONSOLE_QUERY_KEYS), level);
  }

  function filterSource(item: ConsoleStreamItem, negate: boolean) {
    const url = urlOf(item);
    if (url) edit("url", url, negate);
  }

  function actionsFor(item: ConsoleStreamItem): RowAction[] {
    const list = [COPY];
    if (item.kind === "input" || item.kind === "result") list.push(RERUN);
    if (requestOf(item) && host === "drawer" && hasReveal("network")) list.push(REQUEST);
    if (urlOf(item)) list.push(SCRIPT, HIDE_SCRIPT, LOCATION);
    if (host === "drawer") list.push(MOMENT);
    return list;
  }

  async function openRequest(requestId: string) {
    const outcome = await revealMarker({ kind: "network", id: requestId });
    if (outcome === "aged-out") toast.info("That request is no longer kept by Network");
  }

  function run(id: string, row: ConsoleStreamRow, selection: readonly ConsoleStreamRow[] = [row]) {
    const item = row.item;
    switch (id) {
      case "copy":
        void copyText(
          selection.length > 1 ? formatConsoleRows(selection) : itemText(item),
          selection.length > 1 ? "the messages" : "the message",
        );
        return;
      case "rerun":
        if (item.kind === "input" || item.kind === "result") onRerun(item.repl.expression);
        return;
      case "request": {
        const requestId = requestOf(item);
        if (requestId) void openRequest(requestId);
        return;
      }
      case "script":
        filterSource(item, false);
        return;
      case "hide-script":
        filterSource(item, true);
        return;
      case "location": {
        const location = consoleLocation(item);
        if (location) void copyText(location, "the location");
        return;
      }
      case "moment": {
        const target = targets.selectedTarget;
        const serial = target?.source === "adb" ? (target.deviceSerial ?? null) : null;
        strip.showMoment(timeline.toHostMs(serial, item.time));
        return;
      }
      default:
        return;
    }
  }

  return { actionsFor, run, edit, setFloor, filterSource };
}
