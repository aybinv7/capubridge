import type {
  Bounds,
  Decision,
  IndexedControl,
  IndexedElement,
  Observation,
  ScreenPoint,
  TargetRef,
  TargetStrategy,
} from "@/types/automation.types";

/** Maximum candidates a remote policy can choose from in one question. */
export const DEFAULT_CANDIDATE_LIMIT = 255;

/** Columns and rows of the coarse region grid used when capping. */
const REGION_COLUMNS = 3;
const REGION_ROWS = 3;

/** One ranked, selectable target merged from both observation layers. */
export interface Candidate {
  index: number;
  source: "webview" | "native";
  bounds: Bounds;
  center: ScreenPoint;
  label: string;
  cssSelector: string | null;
  text: string | null;
  nativeIndex: number | null;
  clickable: boolean;
  isInput: boolean;
}

/** One coarse screen region with the candidate count inside it. */
export interface ScreenRegion {
  id: string;
  bounds: Bounds;
  count: number;
}

/**
 * Bounded selection set. Under the limit the caller chooses directly; over
 * the limit the caller picks a region first and re-caps within it. The set
 * is never silently truncated.
 */
export type CappedResult =
  | { kind: "direct"; candidates: Candidate[] }
  | { kind: "regions"; regions: ScreenRegion[]; total: number };

/** A target resolved to a screen point, or a miss carrying a reason. */
export type Resolution =
  | { ok: true; point: ScreenPoint; strategy: TargetStrategy; candidateIndex: number | null }
  | { ok: false; reason: string };

/**
 * Merges WebView elements and native controls into one ranked candidate
 * list. Accepts the raw observation or the redacted layers: remote policies
 * must derive their choice set from the redacted layers so candidate labels
 * can never carry an unmasked value, no matter what the caller passes.
 * Indices are stable within one observation: building twice from the same
 * observation yields identical indices. They are meaningless across
 * observations, so decisions must be validated against the observation they
 * were made from.
 */
export function buildCandidates(observation: Pick<Observation, "native" | "webview">): Candidate[] {
  const merged: Candidate[] = [];
  if (observation.webview !== null) {
    for (const element of observation.webview.elements) {
      const candidate = webviewCandidate(element);
      if (candidate !== null) {
        merged.push(candidate);
      }
    }
  }
  for (const control of observation.native.controls) {
    if (!keepNative(control)) {
      continue;
    }
    if (merged.some((candidate) => describesSameTarget(candidate, control))) {
      continue;
    }
    merged.push(nativeCandidate(control));
  }
  merged.sort(compareCandidates);
  merged.forEach((candidate, index) => {
    candidate.index = index;
  });
  return merged;
}

/**
 * Bounds the candidate set. Over the limit, returns coarse regions with
 * counts summing to the full set so a caller can narrow by region.
 */
export function capCandidates(
  candidates: Candidate[],
  limit = DEFAULT_CANDIDATE_LIMIT,
): CappedResult {
  if (candidates.length <= limit) {
    return { kind: "direct", candidates };
  }
  const extent = candidateExtent(candidates);
  const regions: ScreenRegion[] = [];
  const cellWidth = extent.width / REGION_COLUMNS;
  const cellHeight = extent.height / REGION_ROWS;
  for (let row = 0; row < REGION_ROWS; row += 1) {
    for (let column = 0; column < REGION_COLUMNS; column += 1) {
      const bounds: Bounds = [column * cellWidth, row * cellHeight, cellWidth, cellHeight];
      regions.push({ id: `region-${column}-${row}`, bounds, count: 0 });
    }
  }
  for (const candidate of candidates) {
    const column = Math.min(REGION_COLUMNS - 1, Math.floor(candidate.center.x / cellWidth));
    const row = Math.min(REGION_ROWS - 1, Math.floor(candidate.center.y / cellHeight));
    const region = regions[row * REGION_COLUMNS + column];
    if (region !== undefined) {
      region.count += 1;
    }
  }
  return { kind: "regions", regions, total: candidates.length };
}

/**
 * Resolves a target against one observation, trying selector first, text
 * second, native index third and raw point last. A miss never falls back to
 * a point: a run that silently degrades to coordinates has lost the reason
 * the fused observation exists.
 */
export function resolveTarget(target: TargetRef, observation: Observation): Resolution {
  const candidates = buildCandidates(observation);
  switch (target.kind) {
    case "selector": {
      const direct = candidates.find((candidate) => candidate.cssSelector === target.cssSelector);
      if (direct !== undefined) {
        return resolved(direct, "selector");
      }
      const byText = candidates.find(
        (candidate) =>
          candidate.label !== "" &&
          (candidate.label === target.cssSelector ||
            candidate.label.includes(target.cssSelector) ||
            target.cssSelector.includes(candidate.label)),
      );
      if (byText !== undefined) {
        return resolved(byText, "text");
      }
      return { ok: false, reason: `no candidate matches selector "${target.cssSelector}"` };
    }
    case "text": {
      const match = candidates.find(
        (candidate) =>
          candidate.label !== "" &&
          (target.exact ? candidate.label === target.text : candidate.label.includes(target.text)),
      );
      if (match !== undefined) {
        return resolved(match, "text");
      }
      return { ok: false, reason: `no candidate matches text "${target.text}"` };
    }
    case "nativeIndex": {
      const match = candidates.find(
        (candidate) => candidate.source === "native" && candidate.nativeIndex === target.index,
      );
      if (match !== undefined) {
        return resolved(match, "nativeIndex");
      }
      return { ok: false, reason: `no native candidate carries index ${target.index}` };
    }
    case "point": {
      return {
        ok: true,
        point: { x: target.x, y: target.y },
        strategy: "point",
        candidateIndex: null,
      };
    }
  }
}

/**
 * Rejects a decision whose target index does not exist in the observation it
 * was made from. Stale targets are discarded by the executor, never executed
 * against a newer observation.
 */
export function validateDecisionTarget(decision: Decision, observation: Observation): boolean {
  if (decision.target === undefined || decision.target.kind !== "nativeIndex") {
    return true;
  }
  const candidates = buildCandidates(observation);
  const nativeIndex = decision.target.index;
  return candidates.some(
    (candidate) => candidate.source === "native" && candidate.nativeIndex === nativeIndex,
  );
}

/**
 * Shapes one WebView element into a candidate, dropping invisible, disabled
 * and zero-sized entries.
 */
function webviewCandidate(element: IndexedElement): Candidate | null {
  if (!element.visible || !element.enabled || isZeroSized(element.bounds)) {
    return null;
  }
  const label = webviewLabel(element);
  return {
    index: -1,
    source: "webview",
    bounds: element.bounds,
    center: centerOf(element.bounds),
    label,
    cssSelector: element.cssSelector !== "" ? element.cssSelector : null,
    text: element.text !== "" ? element.text : null,
    nativeIndex: null,
    clickable: element.clickable ?? true,
    isInput: element.isInput,
  };
}

/**
 * Visible text first, then the accessible name, then the role. An input is
 * the exception: its `text` is its value, or a redacted summary of it, so it
 * is labelled by its name instead and a typed value never becomes a label.
 */
function webviewLabel(element: IndexedElement): string {
  const name = element.name ?? "";
  if (element.isInput) {
    return name !== "" ? name : element.role;
  }
  if (element.text !== "") {
    return element.text;
  }
  return name !== "" ? name : element.role;
}

/**
 * Reports whether a native control survives filtering. Non-clickable
 * controls survive only when they carry text, which can be the only way to
 * identify a region.
 */
function keepNative(control: IndexedControl): boolean {
  if (isZeroSized(control.bounds)) {
    return false;
  }
  if (control.clickable) {
    return true;
  }
  return control.text !== "" || control.contentDesc !== "";
}

/**
 * Shapes one native control into a candidate.
 */
function nativeCandidate(control: IndexedControl): Candidate {
  const label = control.text !== "" ? control.text : control.contentDesc;
  return {
    index: -1,
    source: "native",
    bounds: control.bounds,
    center: centerOf(control.bounds),
    label,
    cssSelector: null,
    text: label !== "" ? label : null,
    nativeIndex: control.index,
    clickable: control.clickable,
    isInput: /edittext|textfield|input/i.test(control.className),
  };
}

/**
 * Correspondence heuristic: a native control describes the same target as a
 * WebView candidate when the candidate center falls inside the control
 * bounds and their labels correspond. The WebView entry wins because it
 * carries the stable selector.
 */
function describesSameTarget(candidate: Candidate, control: IndexedControl): boolean {
  if (candidate.source !== "webview" || !containsPoint(control.bounds, candidate.center)) {
    return false;
  }
  if (candidate.label === "" || (control.text === "" && control.contentDesc === "")) {
    return false;
  }
  // Both directions must compare non-empty labels. `candidate.label.includes("")`
  // is vacuously true, so an icon-only control — text empty, meaning carried in
  // contentDesc — used to match any WebView element overlapping its bounds and
  // was dropped as a duplicate. Its contentDesc was then the only label that
  // could identify it, and it was gone: every icon-only toolbar control became
  // unreachable by a text target, forcing authored flows onto raw coordinates.
  const nativeLabel = `${control.text} ${control.contentDesc}`.trim();
  if (nativeLabel !== "" && nativeLabel.includes(candidate.label)) {
    return true;
  }
  return control.text !== "" && candidate.label.includes(control.text);
}

/**
 * Ranks by interactability, then stable selector presence, then text
 * presence. WebView entries precede native ones on full ties, and the sort
 * is stable, so equal candidates keep insertion order.
 */
function compareCandidates(left: Candidate, right: Candidate): number {
  const interactability = Number(right.clickable) - Number(left.clickable);
  if (interactability !== 0) {
    return interactability;
  }
  const selector = Number(right.cssSelector !== null) - Number(left.cssSelector !== null);
  if (selector !== 0) {
    return selector;
  }
  const text = Number(right.text !== null) - Number(left.text !== null);
  if (text !== 0) {
    return text;
  }
  if (left.source !== right.source) {
    return left.source === "webview" ? -1 : 1;
  }
  return 0;
}

/**
 * Builds a successful resolution from a candidate and the strategy used.
 */
function resolved(candidate: Candidate, strategy: TargetStrategy): Resolution {
  return { ok: true, point: candidate.center, strategy, candidateIndex: candidate.index };
}

/**
 * Measures the screen extent covered by the candidate set.
 */
function candidateExtent(candidates: Candidate[]): { width: number; height: number } {
  let width = 1;
  let height = 1;
  for (const candidate of candidates) {
    width = Math.max(width, candidate.bounds[0] + candidate.bounds[2]);
    height = Math.max(height, candidate.bounds[1] + candidate.bounds[3]);
  }
  return { width, height };
}

/**
 * Reports whether bounds cover no area.
 */
function isZeroSized(bounds: Bounds): boolean {
  return bounds[2] <= 0 || bounds[3] <= 0;
}

/**
 * Returns the center point of bounds.
 */
function centerOf(bounds: Bounds): ScreenPoint {
  return { x: bounds[0] + bounds[2] / 2, y: bounds[1] + bounds[3] / 2 };
}

/**
 * Reports whether bounds contain the point.
 */
function containsPoint(bounds: Bounds, point: ScreenPoint): boolean {
  return (
    point.x >= bounds[0] &&
    point.x <= bounds[0] + bounds[2] &&
    point.y >= bounds[1] &&
    point.y <= bounds[1] + bounds[3]
  );
}
