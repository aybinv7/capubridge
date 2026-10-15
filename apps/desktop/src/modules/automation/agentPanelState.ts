import { ARTEMIS_SUGGESTED_LIMITS } from "./policies/artemis";
import type { PolicyId } from "./policies/types";

/** Policy metadata the panel renders and runs. Notices always come from the policy object. */
export interface PolicyOption {
  id: PolicyId;
  label: string;
  model?: string;
  isRemote: boolean;
  dataNotice: string | null;
  /**
   * Set when a policy exists but is deliberately parked. The policy stays
   * visible and its code stays in the tree; it simply cannot be selected to
   * run, and this string says why. Preferred over hiding the option, so a
   * parked policy is discoverable rather than mysteriously absent.
   */
  unavailableReason?: string | null;
}

/** How a policy selection presents: runnable or not, and with which notice. */
export interface PolicySelection {
  runnable: boolean;
  remote: boolean;
  notice: string;
}

/** Statement for local policies, which carry a null notice by contract. */
export const LOCAL_POLICY_STATEMENT = "Runs locally. Nothing leaves the machine.";

/**
 * Why ARTEMIS cannot currently be selected. The policy and its transport
 * remain in the tree; only the bridge from this app to the ARTEMIS process is
 * missing, so every decision it made would fail. Parked rather than deleted.
 */
export const ARTEMIS_PARKED_REASON =
  "Artemis is paused. Its bridge to this app is not wired yet, so a run would fail on the first step.";

/** Jev is the default exploration policy; the panel still requires its data notice acknowledgement. */
export const DEFAULT_POLICY_ID: PolicyId = "jev";

/** Render cap for the live step feed. Bounded streaming, logcat precedent. */
export const FEED_RENDER_LIMIT = 100;

/**
 * Describes a policy selection. A remote policy with a null notice cannot
 * run: the notice is the user's consent basis, and a null notice is a
 * defect, not a default-yes.
 */
export function describePolicySelection(policy: PolicyOption): PolicySelection {
  const parked = policy.unavailableReason ?? null;
  if (parked !== null && parked !== "") {
    return { runnable: false, remote: policy.isRemote, notice: parked };
  }
  if (!policy.isRemote) {
    return { runnable: true, remote: false, notice: LOCAL_POLICY_STATEMENT };
  }
  if (policy.dataNotice === null) {
    return {
      runnable: false,
      remote: true,
      notice: "Remote policy without a data notice cannot run.",
    };
  }
  return { runnable: true, remote: true, notice: policy.dataNotice };
}

/** Run limits shown in the panel. */
export interface RunLimitValues {
  maxSteps: number;
  maxDurationMs: number;
  maxConsecutiveFailures: number;
}

/**
 * Default limits per policy. ARTEMIS steps cost seconds (Flash ~5 s,
 * Pro ~30 s), so its duration default is materially larger than Jev's;
 * a Jev-tuned limit would kill an ARTEMIS run immediately.
 */
export function defaultLimitsFor(policyId: PolicyId): RunLimitValues {
  switch (policyId) {
    case "rules":
      return { maxSteps: 40, maxDurationMs: 5 * 60_000, maxConsecutiveFailures: 3 };
    case "jev":
      return { maxSteps: 40, maxDurationMs: 5 * 60_000, maxConsecutiveFailures: 5 };
    case "embedded":
      return { maxSteps: 40, maxDurationMs: 5 * 60_000, maxConsecutiveFailures: 5 };
    case "artemis":
      return { ...ARTEMIS_SUGGESTED_LIMITS.flash };
  }
}

/** One live step-feed row. */
export interface FeedEntry {
  seq: number;
  stepId: string;
  operation: string;
  confidence: number | null;
  outcome: string;
  detail: string | null;
}

/**
 * Appends a feed entry, keeping sequence order when results arrive out of
 * order. Entries sharing a sequence number replace each other.
 */
export function appendFeedEntry(feed: FeedEntry[], entry: FeedEntry): FeedEntry[] {
  return [...feed.filter((existing) => existing.seq !== entry.seq), entry].sort(
    (left, right) => left.seq - right.seq,
  );
}

/** Panel run lifecycle. */
export type AgentPanelRunState = "idle" | "running" | "passed" | "failed" | "halted" | "cancelled";

/** What the panel shows for one run. */
export interface AgentRunView {
  state: AgentPanelRunState;
  entries: FeedEntry[];
  failureReason: string | null;
}

/**
 * Creates the idle view.
 */
export function createRunView(): AgentRunView {
  return { state: "idle", entries: [], failureReason: null };
}

/**
 * Transitions an idle view to running with a cleared feed.
 */
export function startRunView(): AgentRunView {
  return { state: "running", entries: [], failureReason: null };
}

/**
 * Appends a feed entry while running. Entries arriving after the run left
 * the running state are dropped, so cancellation stops the feed.
 */
export function appendRunEntry(view: AgentRunView, entry: FeedEntry): AgentRunView {
  if (view.state !== "running") {
    return view;
  }
  return { ...view, entries: appendFeedEntry(view.entries, entry) };
}

/**
 * Cancels a running view, keeping the entries recorded so far.
 */
export function cancelRunView(view: AgentRunView): AgentRunView {
  if (view.state !== "running") {
    return view;
  }
  return { ...view, state: "cancelled" };
}

/**
 * Finishes a running view with the executor outcome.
 */
export function finishRunView(
  view: AgentRunView,
  state: Exclude<AgentPanelRunState, "idle" | "running" | "cancelled">,
  failureReason: string | null,
): AgentRunView {
  if (view.state !== "running") {
    return view;
  }
  return { ...view, state, failureReason };
}
