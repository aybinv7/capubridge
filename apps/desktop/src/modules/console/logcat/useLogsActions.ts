import type { Ref } from "vue";
import { ChartNoAxesGantt, Copy, EyeOff, Filter, Cpu } from "lucide-vue-next";
import { formatLogcatLine } from "@/lib/logcat/logcatEntry";
import { LOGCAT_QUERY_KEYS } from "@/lib/logcat/logcatQuery";
import { parseQuery } from "@/lib/stream-query/parseQuery";
import { appendTerm, withLevelFloor } from "@/lib/stream-query/queryEdit";
import { useDrawerHost } from "@/shared/drawer/toolbarSlot";
import { useTimelineStore } from "@/stores/timeline.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import type { LogcatEntry } from "@/types/logcat.types";
import { copyText } from "../list/copyText";
import type { RowAction } from "../list/streamView.types";
import type { LogsRow } from "./useLogsRows";

const COPY: RowAction = { id: "copy", label: "Copy line", icon: Copy };
const TAG: RowAction = { id: "tag", label: "Filter to this tag", icon: Filter };
const HIDE_TAG: RowAction = { id: "hide-tag", label: "Hide this tag", icon: EyeOff };
const PROCESS: RowAction = { id: "process", label: "Only this process", icon: Cpu };
const MOMENT: RowAction = {
  id: "moment",
  label: "Show this moment on the timeline",
  icon: ChartNoAxesGantt,
};

/** Copies rows as logcat prints them, repeats written out once per occurrence count. */
export function formatLogsRows(rows: readonly LogsRow[]): string {
  return rows
    .map((row) => {
      const line = formatLogcatLine(row.last);
      return row.count > 1 ? `${line}  (×${row.count})` : line;
    })
    .join("\n");
}

/** What a Logs row offers, in its menu and when opened, and what each one does. */
export function useLogsActions(query: Ref<string>) {
  const host = useDrawerHost();
  const timeline = useTimelineStore();
  const strip = useTimelineStripStore();

  function edit(key: string, value: string, negate: boolean) {
    query.value = appendTerm(parseQuery(query.value, LOGCAT_QUERY_KEYS), key, value, negate);
  }

  function setFloor(level: string | null) {
    query.value = withLevelFloor(parseQuery(query.value, LOGCAT_QUERY_KEYS), level);
  }

  function actionsFor(entry: LogcatEntry): RowAction[] {
    if (entry.marker) return host === "drawer" ? [COPY, MOMENT] : [COPY];
    const list = [COPY, TAG, HIDE_TAG];
    if (entry.pid !== null) list.push(PROCESS);
    if (host === "drawer") list.push(MOMENT);
    return list;
  }

  function run(id: string, row: LogsRow, selection: readonly LogsRow[] = [row]) {
    const entry = row.last;
    switch (id) {
      case "copy":
        void copyText(formatLogsRows(selection), selection.length > 1 ? "the lines" : "the line");
        return;
      case "tag":
        edit("tag", entry.tag, false);
        return;
      case "hide-tag":
        edit("tag", entry.tag, true);
        return;
      case "process":
        if (entry.pid !== null) edit("pid", String(entry.pid), false);
        return;
      case "moment":
        strip.showMoment(timeline.toHostMs(entry.serial, entry.tsMs));
        return;
      default:
        return;
    }
  }

  return { actionsFor, run, edit, setFloor };
}
