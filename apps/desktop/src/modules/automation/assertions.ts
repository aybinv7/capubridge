import type { Assertion, Observation, TargetRef } from "@/types/automation.types";

/** Live DOM probe for one selector. Null means the read succeeded and the element is absent. */
export interface DomProbe {
  text: string;
  visible: boolean;
}

/** Database row query for dbRowExists. */
export interface DbRowQuery {
  database: string;
  store: string;
  key: string;
}

/** One recent network entry. */
export interface NetworkProbe {
  url: string;
  method: string;
  status: number | null;
}

/** One recent console entry. */
export interface ConsoleProbe {
  level: string;
  text: string;
}

/**
 * Injected evidence reads. Assertions are pure with respect to the device:
 * they read, never act, and never consult a policy. A policy's done answer
 * is a hint to stop stepping, never a pass.
 */
export interface EvidenceReaders {
  observe(): Promise<Observation>;
  queryDom(cssSelector: string): Promise<DomProbe | null>;
  currentUrl(): Promise<string>;
  dbRow(query: DbRowQuery): Promise<unknown>;
  recentNetwork(): Promise<NetworkProbe[]>;
  recentConsole(): Promise<ConsoleProbe[]>;
}

/** Polling budget for one assertion. */
export interface AssertionOptions {
  timeoutMs: number;
  pollMs: number;
}

/** Pass or fail decided from observed evidence, with what was actually seen. */
export interface AssertionResult {
  passed: boolean;
  assertion: Assertion;
  elapsedMs: number;
  attempts: number;
  observed: string;
}

/**
 * Evaluates one assertion against live evidence, polling on a bounded
 * interval up to timeoutMs. Succeeds as soon as the condition holds; fails
 * with what was actually observed at the end. A failed read is an error,
 * never a pass.
 */
export async function evaluateAssertion(
  assertion: Assertion,
  evidence: EvidenceReaders,
  options: AssertionOptions,
): Promise<AssertionResult> {
  const startedAt = Date.now();
  const finish = (passed: boolean, attempts: number, observed: string): AssertionResult => ({
    passed,
    assertion,
    elapsedMs: Date.now() - startedAt,
    attempts,
    observed,
  });
  let attempts = 0;
  let observed = "no poll completed";
  for (;;) {
    attempts += 1;
    let check: { passed: boolean; fatal: boolean; observed: string };
    try {
      check = await checkOnce(assertion, evidence);
    } catch (error) {
      return finish(false, attempts, `error reading evidence: ${messageOf(error)}`);
    }
    if (check.passed || check.fatal) {
      return finish(check.passed, attempts, check.observed);
    }
    observed = check.observed;
    if (Date.now() - startedAt >= options.timeoutMs) {
      return finish(false, attempts, observed);
    }
    await sleep(options.pollMs);
  }
}

/** One poll: pass, retryable failure, or fatal read error. */
interface PollCheck {
  passed: boolean;
  fatal: boolean;
  observed: string;
}

/**
 * Checks the assertion once against current evidence.
 */
async function checkOnce(assertion: Assertion, evidence: EvidenceReaders): Promise<PollCheck> {
  switch (assertion.kind) {
    case "visible":
      return checkVisibility(assertion.target, assertion.source, evidence, true);
    case "notVisible":
      return checkVisibility(assertion.target, assertion.source, evidence, false);
    case "textEquals":
      return checkText(
        assertion.target,
        evidence,
        `expected "${assertion.expected}"`,
        (text) => text === assertion.expected,
      );
    case "textContains":
      return checkText(assertion.target, evidence, `containing "${assertion.substring}"`, (text) =>
        text.includes(assertion.substring),
      );
    case "urlMatches":
      return checkUrl(assertion.pattern, evidence);
    case "dbRowExists":
      return checkDbRow(assertion.database, assertion.store, assertion.key, evidence);
    case "networkStatus":
      return checkNetwork(assertion.urlPattern, assertion.status, assertion.method, evidence);
    case "consoleClean":
      return checkConsole(assertion.level, assertion.ignorePatterns ?? [], evidence);
  }
}

/**
 * Checks presence or absence. Selector targets read the live DOM, which is
 * the authority for selectors; other targets match the fused snapshot.
 */
async function checkVisibility(
  target: TargetRef,
  source: "dom" | "native",
  evidence: EvidenceReaders,
  expectVisible: boolean,
): Promise<PollCheck> {
  if (target.kind === "selector") {
    let probe: DomProbe | null;
    try {
      probe = await evidence.queryDom(target.cssSelector);
    } catch (error) {
      return fail(`error reading DOM for selector "${target.cssSelector}": ${messageOf(error)}`);
    }
    if (probe === null) {
      return expectVisible
        ? retry(`element "${target.cssSelector}" absent`)
        : pass(`element "${target.cssSelector}" absent`);
    }
    if (!probe.visible) {
      return expectVisible
        ? retry(`element "${target.cssSelector}" present but hidden`)
        : pass(`element "${target.cssSelector}" present but hidden`);
    }
    return expectVisible
      ? pass(`element "${target.cssSelector}" visible with text "${probe.text}"`)
      : retry(`element "${target.cssSelector}" visible with text "${probe.text}"`);
  }
  let match: SnapshotMatch;
  try {
    match = matchSnapshot(target, await evidence.observe(), source);
  } catch (error) {
    return fail(`error observing for visibility: ${messageOf(error)}`);
  }
  if (match.kind === "unsupported") {
    return fail(`cannot assert visibility of a point target`);
  }
  if (!match.present) {
    return expectVisible
      ? retry(describeTarget(target, "absent"))
      : pass(describeTarget(target, "absent"));
  }
  if (!match.visible) {
    return expectVisible
      ? retry(describeTarget(target, "present but hidden"))
      : pass(describeTarget(target, "present but hidden"));
  }
  return expectVisible
    ? pass(describeTarget(target, `visible with text "${match.text}"`))
    : retry(describeTarget(target, `visible with text "${match.text}"`));
}

/**
 * Checks element text. Selector targets read the live DOM; other targets
 * match the fused snapshot.
 */
async function checkText(
  target: TargetRef,
  evidence: EvidenceReaders,
  expectation: string,
  matches: (text: string) => boolean,
): Promise<PollCheck> {
  if (target.kind === "selector") {
    let probe: DomProbe | null;
    try {
      probe = await evidence.queryDom(target.cssSelector);
    } catch (error) {
      return fail(`error reading DOM for selector "${target.cssSelector}": ${messageOf(error)}`);
    }
    if (probe === null) {
      return retry(`element "${target.cssSelector}" absent (${expectation})`);
    }
    if (matches(probe.text)) {
      return pass(`element "${target.cssSelector}" text "${probe.text}"`);
    }
    return retry(`element "${target.cssSelector}" text "${probe.text}" (${expectation})`);
  }
  let match: SnapshotMatch;
  try {
    match = matchSnapshot(target, await evidence.observe(), "both");
  } catch (error) {
    return fail(`error observing for text: ${messageOf(error)}`);
  }
  if (match.kind === "unsupported") {
    return fail(`cannot assert text of a point target`);
  }
  if (!match.present) {
    return retry(`${describeTarget(target, "absent")} (${expectation})`);
  }
  if (matches(match.text)) {
    return pass(describeTarget(target, `text "${match.text}"`));
  }
  return retry(`${describeTarget(target, `text "${match.text}"`)} (${expectation})`);
}

/**
 * Checks the current URL against a regex pattern.
 */
async function checkUrl(pattern: string, evidence: EvidenceReaders): Promise<PollCheck> {
  let expression: RegExp;
  try {
    expression = new RegExp(pattern);
  } catch {
    return fail(`invalid url pattern "${pattern}"`);
  }
  let url: string;
  try {
    url = await evidence.currentUrl();
  } catch (error) {
    return fail(`error reading current URL: ${messageOf(error)}`);
  }
  if (expression.test(url)) {
    return pass(`url "${url}" matches "${pattern}"`);
  }
  return retry(`url "${url}" does not match "${pattern}"`);
}

/**
 * Checks that a database row exists.
 */
async function checkDbRow(
  database: string,
  store: string,
  key: string,
  evidence: EvidenceReaders,
): Promise<PollCheck> {
  let row: unknown;
  try {
    row = await evidence.dbRow({ database, store, key });
  } catch (error) {
    return fail(`error reading database row: ${messageOf(error)}`);
  }
  if (row !== null && row !== undefined) {
    return pass(`row for key "${key}" present in ${database}/${store}`);
  }
  return retry(`no row for key "${key}" in ${database}/${store}`);
}

/**
 * Checks that a matching request reached the expected status.
 */
async function checkNetwork(
  urlPattern: string,
  status: number,
  method: string | undefined,
  evidence: EvidenceReaders,
): Promise<PollCheck> {
  let entries: NetworkProbe[];
  try {
    entries = await evidence.recentNetwork();
  } catch (error) {
    return fail(`error reading network entries: ${messageOf(error)}`);
  }
  const matching = entries.filter(
    (entry) =>
      entry.url.includes(urlPattern) &&
      (method === undefined || entry.method.toLowerCase() === method.toLowerCase()),
  );
  if (matching.some((entry) => entry.status === status)) {
    return pass(`request to "${urlPattern}" reached status ${status}`);
  }
  const seen = matching.map((entry) => String(entry.status)).join(", ");
  return retry(
    matching.length === 0
      ? `no requests to "${urlPattern}" yet`
      : `requests to "${urlPattern}" show statuses [${seen}] (expected ${status})`,
  );
}

/**
 * Checks that no console entry at or above the threshold survives the
 * ignore patterns.
 */
async function checkConsole(
  level: "warn" | "error",
  ignorePatterns: string[],
  evidence: EvidenceReaders,
): Promise<PollCheck> {
  let entries: ConsoleProbe[];
  try {
    entries = await evidence.recentConsole();
  } catch (error) {
    return fail(`error reading console entries: ${messageOf(error)}`);
  }
  const threshold = level === "error" ? ["error"] : ["warn", "error"];
  const remaining = entries.filter(
    (entry) =>
      threshold.includes(entry.level) &&
      !ignorePatterns.some((pattern) => entry.text.includes(pattern)),
  );
  if (remaining.length === 0) {
    return pass(`no console entries at or above ${level}`);
  }
  const shown = remaining
    .slice(0, 3)
    .map((entry) => `[${entry.level}] ${entry.text}`)
    .join("; ");
  return retry(`console entries at or above ${level}: ${shown}`);
}

/** A target matched against the fused snapshot. */
type SnapshotMatch =
  | { kind: "unsupported" }
  | { kind: "matched"; present: boolean; visible: boolean; text: string };

/**
 * Matches a target against the fused snapshot. Selector targets match
 * WebView elements by cssSelector; text targets match element or control
 * labels; native index targets match controls by position.
 */
function matchSnapshot(
  target: TargetRef,
  observation: Observation,
  layer: "dom" | "native" | "both",
): SnapshotMatch {
  switch (target.kind) {
    case "selector": {
      if (observation.webview === null) {
        return { kind: "matched", present: false, visible: false, text: "" };
      }
      const element = observation.webview.elements.find(
        (entry) => entry.cssSelector === target.cssSelector,
      );
      if (element === undefined) {
        return { kind: "matched", present: false, visible: false, text: "" };
      }
      return { kind: "matched", present: true, visible: element.visible, text: element.text };
    }
    case "text": {
      if ((layer === "dom" || layer === "both") && observation.webview !== null) {
        const element = observation.webview.elements.find((entry) =>
          target.exact ? entry.text === target.text : entry.text.includes(target.text),
        );
        if (element !== undefined) {
          return { kind: "matched", present: true, visible: element.visible, text: element.text };
        }
      }
      if (layer === "native" || layer === "both") {
        const control = observation.native.controls.find((entry) => {
          const label = entry.text !== "" ? entry.text : entry.contentDesc;
          return target.exact ? label === target.text : label.includes(target.text);
        });
        if (control !== undefined) {
          const label = control.text !== "" ? control.text : control.contentDesc;
          return { kind: "matched", present: true, visible: control.enabled, text: label };
        }
      }
      return { kind: "matched", present: false, visible: false, text: "" };
    }
    case "nativeIndex": {
      const control = observation.native.controls[target.index];
      if (control === undefined) {
        return { kind: "matched", present: false, visible: false, text: "" };
      }
      const label = control.text !== "" ? control.text : control.contentDesc;
      return { kind: "matched", present: true, visible: control.enabled, text: label };
    }
    case "point": {
      return { kind: "unsupported" };
    }
  }
}

/**
 * Describes a non-selector target for an observed message.
 */
function describeTarget(target: TargetRef, state: string): string {
  switch (target.kind) {
    case "selector":
      return `element "${target.cssSelector}" ${state}`;
    case "text":
      return `element with text "${target.text}" ${state}`;
    case "nativeIndex":
      return `native control ${target.index} ${state}`;
    case "point":
      return `point (${target.x}, ${target.y}) ${state}`;
  }
}

/**
 * Builds a passing poll result.
 */
function pass(observed: string): PollCheck {
  return { passed: true, fatal: false, observed };
}

/**
 * Builds a retryable failing poll result.
 */
function retry(observed: string): PollCheck {
  return { passed: false, fatal: false, observed };
}

/**
 * Builds a fatal poll result: the read itself failed, so the outcome is an
 * error rather than a pass.
 */
function fail(observed: string): PollCheck {
  return { passed: false, fatal: true, observed };
}

/**
 * Sleeps between polls. Fake-timer controlled in tests.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Renders an unknown failure for an error message without throwing.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}
