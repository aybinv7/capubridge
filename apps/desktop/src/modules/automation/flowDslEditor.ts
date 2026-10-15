import type { AutomationCandidate } from "@/types/automation.types";
import { serializeFlowDslTarget } from "./flowDsl";

export interface FlowDslCompletion {
  label: string;
  insertText: string;
  detail: string;
  replaceStart: number;
  replaceEnd: number;
}

export interface AppliedFlowDslCompletion {
  source: string;
  cursor: number;
}

const COMMAND_DETAILS: Record<string, string> = {
  tap: "Tap a live or explicit target",
  type: "Enter text and verify the field",
  scroll: "Scroll the current screen",
  assert: "Verify an observed condition",
  wait: "Wait for a bounded duration",
  longPress: "Hold a target",
  swipe: "Swipe between screen points",
  pressKey: "Send an Android key code",
  back: "Navigate back",
  openApp: "Open an installed package",
  goal: "Run a bounded policy goal",
};

const COMMAND_INSERT_TEXT: Record<string, string> = {
  tap: 'tap selector ""',
  longPress: 'longPress selector ""',
  type: 'type selector "" ""',
  swipe: "swipe 0 0 0 100",
  scroll: "scroll down 400",
  pressKey: "pressKey KEYCODE_ENTER",
  back: "back",
  openApp: "openApp com.example.app",
  wait: "wait 500",
  assert: 'assert visible selector "" dom',
  goal: 'goal jev "Describe the goal" 40 300000 3',
};

export function getFlowDslCompletions(
  source: string,
  cursor: number,
  candidates: readonly AutomationCandidate[],
): FlowDslCompletion[] {
  const safeCursor = Math.max(0, Math.min(cursor, source.length));
  const lineStart = source.lastIndexOf("\n", safeCursor - 1) + 1;
  const linePrefix = source.slice(lineStart, safeCursor);
  const leadingWhitespace = linePrefix.match(/^\s*/)?.[0].length ?? 0;
  const content = linePrefix.slice(leadingWhitespace);
  const commandPrefix = content.trim();

  if (!content.includes(" ") && !content.includes("\t")) {
    const prefix = commandPrefix.toLowerCase();
    return Object.keys(COMMAND_INSERT_TEXT)
      .filter((command) => command.startsWith(prefix))
      .map((command) => ({
        label: command,
        insertText: COMMAND_INSERT_TEXT[command] ?? command,
        detail: COMMAND_DETAILS[command] ?? "Automation command",
        replaceStart: lineStart + leadingWhitespace,
        replaceEnd: safeCursor,
      }));
  }

  const operation = content.split(/\s+/)[0] ?? "";
  if (
    !["tap", "longPress", "type"].includes(operation) ||
    !/^\s*(tap|longPress|type)\s+$/.test(linePrefix)
  ) {
    return [];
  }
  return candidates.slice(0, 12).map((candidate) => ({
    label: candidate.label,
    insertText: `${operation} ${serializeFlowDslTarget(candidate.target)}`,
    detail: `${candidate.source} target`,
    replaceStart: lineStart + leadingWhitespace,
    replaceEnd: safeCursor,
  }));
}

export function applyFlowDslCompletion(
  source: string,
  completion: FlowDslCompletion,
): AppliedFlowDslCompletion {
  const start = Math.max(0, Math.min(completion.replaceStart, source.length));
  const end = Math.max(start, Math.min(completion.replaceEnd, source.length));
  const nextSource = `${source.slice(0, start)}${completion.insertText}${source.slice(end)}`;
  return { source: nextSource, cursor: start + completion.insertText.length };
}
