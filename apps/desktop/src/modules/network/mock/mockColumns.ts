import type { MockRule } from "@/types/mock.types";
import type { ListColumn } from "../columns/listColumns";
import { formatMs } from "../requests/requestCells";

/** Row height of the rules and the log: one line, like the request list. */
export const MOCK_ROW_HEIGHT = 30;

export type MockRuleColumnId =
  | "enabled"
  | "method"
  | "name"
  | "match"
  | "status"
  | "delay"
  | "hits"
  | "actions";

/**
 * The rules list, one fact per column. Rules keep their own order (the first rule that matches
 * answers), so no column sorts. Narrowing drops Delay first, then Hits, Method and the pattern.
 */
export const MOCK_RULE_COLUMNS: readonly ListColumn<MockRuleColumnId>[] = [
  { id: "enabled", label: "On", width: 48, minWidth: 48, align: "start", action: true },
  {
    id: "method",
    label: "Method",
    width: 72,
    minWidth: 52,
    align: "start",
    dropOrder: 3,
  },
  { id: "name", label: "Name", width: 0, minWidth: 120, flex: true, align: "start" },
  {
    id: "match",
    label: "Match",
    width: 220,
    minWidth: 80,
    align: "start",
    dropOrder: 4,
  },
  { id: "status", label: "Status", width: 64, minWidth: 52, align: "start" },
  { id: "delay", label: "Delay", width: 76, minWidth: 56, align: "end", dropOrder: 1 },
  { id: "hits", label: "Hits", width: 60, minWidth: 48, align: "end", dropOrder: 2 },
  {
    id: "actions",
    label: "Delete",
    width: 36,
    minWidth: 36,
    align: "end",
    action: true,
    hideable: false,
  },
];

export type MockLogColumnId = "time" | "method" | "status" | "url" | "rule" | "delay";

/** The interception log, newest first as kept; narrowing drops Delay, then the rule. */
export const MOCK_LOG_COLUMNS: readonly ListColumn<MockLogColumnId>[] = [
  { id: "time", label: "Time", width: 88, minWidth: 72, align: "start" },
  { id: "method", label: "Method", width: 72, minWidth: 52, align: "start", dropOrder: 3 },
  { id: "status", label: "Status", width: 64, minWidth: 52, align: "start" },
  { id: "url", label: "URL", width: 0, minWidth: 160, flex: true, align: "start" },
  { id: "rule", label: "Rule", width: 200, minWidth: 96, align: "start", dropOrder: 2 },
  { id: "delay", label: "Delay", width: 76, minWidth: 56, align: "end", dropOrder: 1 },
];

/** A delay as a cell: "—" when there is none. */
export function delayText(ms: number): string {
  return ms > 0 ? formatMs(ms) : "—";
}

/** What a rule matches, as its Match cell says it. */
export function matchText(rule: Pick<MockRule, "urlPattern">): { text: string; every: boolean } {
  const pattern = rule.urlPattern.trim();
  return pattern ? { text: pattern, every: false } : { text: "Every address", every: true };
}

/** A rule's hit count as a cell: "—" before it matched anything. */
export function hitsText(hits: number): string {
  return hits > 0 ? hits.toLocaleString("en-US") : "—";
}
