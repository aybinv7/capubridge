import type { Assertion, Flow, FlowStep, TargetRef } from "@/types/automation.types";
import { buildStep } from "./flowBuild";
import type { FlowParseError } from "./flowShared";
import { validateStepAt } from "./flowValidate";
import { POLICY_IDS } from "./flowShared";
import { isRemovedArtemis, REMOVED_ARTEMIS_MESSAGE } from "./removedPolicies";
import type { PolicyId } from "./policies/types";

export type FlowDslResult = { ok: true; flow: Flow } | { ok: false; errors: FlowParseError[] };

export const FLOW_DSL_COMMANDS = [
  'tap selector "#login"',
  'type selector "input[name=email]" "user@example.com"',
  "scroll down 400",
  'assert textContains selector "#status" "Done"',
  "wait 500",
] as const;

export function parseFlowDsl(source: string, base: Flow): FlowDslResult {
  const errors: FlowParseError[] = [];
  const steps: FlowStep[] = [];
  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      return;
    }
    const tokenized = tokenize(trimmed);
    if (!tokenized.ok) {
      errors.push({ path: `line ${lineNumber}`, message: tokenized.message });
      return;
    }
    const [operation, ...args] = tokenized.tokens;
    if (operation === undefined) {
      return;
    }
    let raw: Record<string, unknown>;
    try {
      raw = parseStep(operation, args, lineNumber);
    } catch (error) {
      errors.push({ path: `line ${lineNumber}`, message: messageOf(error) });
      return;
    }
    const stepErrors = validateStepAt(raw, `line ${lineNumber}`);
    if (stepErrors.length > 0) {
      errors.push(...stepErrors);
      return;
    }
    const step = buildStep(raw);
    if (step === null) {
      errors.push({ path: `line ${lineNumber}`, message: "step could not be built" });
      return;
    }
    steps.push(step);
  });
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    flow: {
      ...base,
      steps,
    },
  };
}

export function serializeFlowDsl(flow: Flow): string {
  if (flow.steps.length === 0) {
    return "";
  }
  return `${flow.steps.map(serializeStep).join("\n")}\n`;
}

function parseStep(operation: string, args: string[], line: number): Record<string, unknown> {
  const base = { id: `dsl-${line}` };
  switch (operation) {
    case "tap": {
      const parsed = parseTarget(args, 0);
      expectEnd(args, parsed.next);
      return { ...base, op: operation, target: parsed.target };
    }
    case "longPress": {
      const parsed = parseTarget(args, 0);
      const durationMs = optionalNumber(args, parsed.next);
      expectEnd(args, durationMs.next);
      return {
        ...base,
        op: operation,
        target: parsed.target,
        ...(durationMs.value === undefined ? {} : { durationMs: durationMs.value }),
      };
    }
    case "type": {
      const parsed = parseTarget(args, 0);
      const text = required(args, parsed.next, "text");
      const readback = args[parsed.next + 1];
      if (readback !== undefined && readback !== "no-readback" && readback !== "readback") {
        throw new Error('expected "readback" or "no-readback"');
      }
      expectEnd(args, readback === undefined ? parsed.next + 1 : parsed.next + 2);
      return {
        ...base,
        op: operation,
        target: parsed.target,
        text,
        verifyReadback: readback !== "no-readback",
      };
    }
    case "swipe": {
      const from = { x: numberAt(args, 0, "from x"), y: numberAt(args, 1, "from y") };
      const to = { x: numberAt(args, 2, "to x"), y: numberAt(args, 3, "to y") };
      const durationMs = optionalNumber(args, 4);
      expectEnd(args, durationMs.next);
      return {
        ...base,
        op: operation,
        from,
        to,
        ...(durationMs.value === undefined ? {} : { durationMs: durationMs.value }),
      };
    }
    case "scroll": {
      const direction = required(args, 0, "direction");
      if (!["up", "down", "left", "right"].includes(direction)) {
        throw new Error("direction must be up, down, left, or right");
      }
      const distance =
        args[1] !== undefined && Number.isFinite(Number(args[1]))
          ? optionalNumber(args, 1)
          : { value: undefined, next: 1 };
      let next = distance.next;
      let target: TargetRef | undefined;
      if (next < args.length) {
        const parsed = parseTarget(args, next);
        target = parsed.target;
        next = parsed.next;
      }
      expectEnd(args, next);
      return {
        ...base,
        op: operation,
        direction,
        ...(distance.value === undefined ? {} : { distance: distance.value }),
        ...(target === undefined ? {} : { target }),
      };
    }
    case "pressKey":
      return { ...base, op: operation, keycode: only(args, "keycode") };
    case "back":
      expectEnd(args, 0);
      return { ...base, op: operation };
    case "openApp":
      return { ...base, op: operation, packageName: only(args, "package") };
    case "wait":
      return { ...base, op: operation, durationMs: numberAt(args, 0, "duration") };
    case "assert":
      return { ...base, op: operation, assertion: parseAssertion(args) };
    case "goal": {
      const policyId = required(args, 0, "policy");
      if (isRemovedArtemis(policyId)) {
        throw new Error(REMOVED_ARTEMIS_MESSAGE);
      }
      if (!POLICY_IDS.includes(policyId as PolicyId)) {
        throw new Error(`policy must be ${POLICY_IDS.join(", ")}`);
      }
      const goal = required(args, 1, "goal");
      const maxSteps = numberAt(args, 2, "max steps");
      const maxDurationMs = numberAt(args, 3, "max duration");
      const maxConsecutiveFailures = numberAt(args, 4, "max failures");
      expectEnd(args, 5);
      return {
        ...base,
        op: operation,
        policyId,
        goal,
        limits: { maxSteps, maxDurationMs, maxConsecutiveFailures },
        acknowledgedNotice: policyId !== "jev",
      };
    }
    default:
      throw new Error(`unknown command "${operation}"`);
  }
}

function parseTarget(args: string[], start: number): { target: TargetRef; next: number } {
  const kind = required(args, start, "target kind");
  switch (kind) {
    case "selector":
      return {
        target: { kind, cssSelector: required(args, start + 1, "selector") },
        next: start + 2,
      };
    case "text": {
      const text = required(args, start + 1, "text target");
      const mode = args[start + 2];
      if (mode !== undefined && mode !== "exact" && mode !== "contains") {
        return { target: { kind, text, exact: true }, next: start + 2 };
      }
      return { target: { kind, text, exact: mode !== "contains" }, next: start + (mode ? 3 : 2) };
    }
    case "nativeIndex":
      return {
        target: { kind, index: numberAt(args, start + 1, "native index") },
        next: start + 2,
      };
    case "point":
      return {
        target: {
          kind,
          x: numberAt(args, start + 1, "point x"),
          y: numberAt(args, start + 2, "point y"),
        },
        next: start + 3,
      };
    default:
      throw new Error("target kind must be selector, text, nativeIndex, or point");
  }
}

function parseAssertion(args: string[]): Assertion {
  const kind = required(args, 0, "assertion kind");
  switch (kind) {
    case "visible":
    case "notVisible": {
      const parsed = parseTarget(args, 1);
      const source = onlyFrom(args, parsed.next, "dom", "native");
      return { kind, target: parsed.target, source };
    }
    case "textEquals":
    case "textContains": {
      const parsed = parseTarget(args, 1);
      const expected = only(
        args.slice(parsed.next),
        kind === "textEquals" ? "expected" : "substring",
      );
      return kind === "textEquals"
        ? { kind, target: parsed.target, expected }
        : { kind, target: parsed.target, substring: expected };
    }
    case "urlMatches":
      return { kind, pattern: only(args.slice(1), "pattern") };
    case "dbRowExists":
      return {
        kind,
        database: required(args, 1, "database"),
        store: required(args, 2, "store"),
        key: required(args, 3, "key"),
      };
    case "networkStatus": {
      const urlPattern = required(args, 1, "url pattern");
      const status = numberAt(args, 2, "status");
      const method = args[3];
      expectEnd(args, method === undefined ? 3 : 4);
      return { kind, urlPattern, status, ...(method === undefined ? {} : { method }) };
    }
    case "consoleClean": {
      const level = onlyFrom(args, 1, "warn", "error");
      return { kind, level };
    }
    default:
      throw new Error(`unknown assertion "${kind}"`);
  }
}

function serializeStep(step: FlowStep): string {
  switch (step.op) {
    case "tap":
      return `tap ${serializeFlowDslTarget(step.target)}`;
    case "longPress":
      return `longPress ${serializeFlowDslTarget(step.target)}${step.durationMs === undefined ? "" : ` ${step.durationMs}`}`;
    case "type":
      return `type ${serializeFlowDslTarget(step.target)} ${quote(step.text)}${step.verifyReadback === false ? " no-readback" : ""}`;
    case "swipe":
      return `swipe ${step.from.x} ${step.from.y} ${step.to.x} ${step.to.y}${step.durationMs === undefined ? "" : ` ${step.durationMs}`}`;
    case "scroll":
      return `scroll ${step.direction}${step.distance === undefined ? "" : ` ${step.distance}`}${step.target === undefined ? "" : ` ${serializeFlowDslTarget(step.target)}`}`;
    case "pressKey":
      return `pressKey ${step.keycode}`;
    case "back":
      return "back";
    case "openApp":
      return `openApp ${step.packageName}`;
    case "wait":
      return `wait ${step.durationMs}`;
    case "assert":
      return `assert ${serializeAssertion(step.assertion)}`;
    case "goal":
      return `goal ${step.policyId} ${quote(step.goal)} ${step.limits.maxSteps} ${step.limits.maxDurationMs} ${step.limits.maxConsecutiveFailures}`;
  }
}

export function serializeFlowDslTarget(target: TargetRef): string {
  switch (target.kind) {
    case "selector":
      return `selector ${quote(target.cssSelector)}`;
    case "text":
      return `text ${quote(target.text)}${target.exact ? "" : " contains"}`;
    case "nativeIndex":
      return `nativeIndex ${target.index}`;
    case "point":
      return `point ${target.x} ${target.y}`;
  }
}

function serializeAssertion(assertion: Assertion): string {
  switch (assertion.kind) {
    case "visible":
    case "notVisible":
      return `${assertion.kind} ${serializeFlowDslTarget(assertion.target)} ${assertion.source}`;
    case "textEquals":
      return `${assertion.kind} ${serializeFlowDslTarget(assertion.target)} ${quote(assertion.expected)}`;
    case "textContains":
      return `${assertion.kind} ${serializeFlowDslTarget(assertion.target)} ${quote(assertion.substring)}`;
    case "urlMatches":
      return `${assertion.kind} ${quote(assertion.pattern)}`;
    case "dbRowExists":
      return `${assertion.kind} ${quote(assertion.database)} ${quote(assertion.store)} ${quote(assertion.key)}`;
    case "networkStatus":
      return `${assertion.kind} ${quote(assertion.urlPattern)} ${assertion.status}${assertion.method === undefined ? "" : ` ${assertion.method}`}`;
    case "consoleClean":
      return `${assertion.kind} ${assertion.level}`;
  }
}

function tokenize(line: string): { ok: true; tokens: string[] } | { ok: false; message: string } {
  const tokens: string[] = [];
  let current = "";
  let quoted = false;
  let escaping = false;
  let sawValue = false;
  for (const char of line) {
    if (escaping) {
      current += char === "n" ? "\n" : char === "r" ? "\r" : char;
      escaping = false;
      sawValue = true;
      continue;
    }
    if (quoted && char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      sawValue = true;
      continue;
    }
    if (!quoted && /\s/.test(char)) {
      if (sawValue) {
        tokens.push(current);
        current = "";
        sawValue = false;
      }
      continue;
    }
    current += char;
    sawValue = true;
  }
  if (escaping || quoted) {
    return { ok: false, message: "unterminated quoted value" };
  }
  if (sawValue) {
    tokens.push(current);
  }
  return { ok: true, tokens };
}

function required(args: string[], index: number, name: string): string {
  const value = args[index];
  if (value === undefined || value === "") {
    throw new Error(`missing ${name}`);
  }
  return value;
}

function only(args: string[], name: string): string {
  const value = required(args, 0, name);
  expectEnd(args, 1);
  return value;
}

function onlyFrom<T extends string>(args: string[], index: number, ...allowed: T[]): T {
  const value = required(args, index, "value");
  expectEnd(args, index + 1);
  if (!allowed.includes(value as T)) {
    throw new Error(`value must be ${allowed.join(" or ")}`);
  }
  return value as T;
}

function numberAt(args: string[], index: number, name: string): number {
  const raw = required(args, index, name);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  return value;
}

function optionalNumber(
  args: string[],
  index: number,
): { value: number | undefined; next: number } {
  const raw = args[index];
  if (raw === undefined) {
    return { value: undefined, next: index };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("expected a number");
  }
  return { value, next: index + 1 };
}

function expectEnd(args: string[], next: number): void {
  if (next < args.length) {
    throw new Error(`unexpected value "${args[next] ?? ""}"`);
  }
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
