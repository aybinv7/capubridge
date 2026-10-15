import type { Decision, FlowStep } from "@/types/automation.types";
import { resolveTarget } from "../elementIndex";
import { registerPolicy } from "./types";
import type { LocalPolicy, PolicyInput } from "./types";

/**
 * One ordered intent: the manual-flow vocabulary reused as a policy. Assert
 * steps are excluded because verification belongs to the executor, not to a
 * decision; swipe and scroll intents are answered blocked because a
 * single-target decision cannot express a gesture.
 */
export type RuleIntent = Exclude<FlowStep, { op: "assert" }>;

/** Options for the rules policy. */
export interface RulesPolicyOptions {
  settleBudgetMs?: number;
  textFallbackConfidence?: number;
  now?: () => number;
}

/** Confidence for a target resolved through text fallback rather than directly. */
const DEFAULT_TEXT_FALLBACK_CONFIDENCE = 0.6;

/** How long an unresolvable target keeps answering wait before blocking. */
const DEFAULT_SETTLE_BUDGET_MS = 3000;

/**
 * Deterministic policy with no model, no network and no vendor. Replays
 * intents against live observations, which makes a manual flow resilient to
 * timing instead of brittle: pending requests and absent-but-settling
 * targets answer wait, exhausted intents answer done, and only assertions
 * decide pass or fail.
 */
export function createRulesPolicy(
  intents: RuleIntent[],
  options: RulesPolicyOptions = {},
): LocalPolicy {
  const settleBudgetMs = options.settleBudgetMs ?? DEFAULT_SETTLE_BUDGET_MS;
  const fallbackConfidence = options.textFallbackConfidence ?? DEFAULT_TEXT_FALLBACK_CONFIDENCE;
  const now = options.now ?? Date.now;
  let lastIntentIndex = -1;
  let firstUnresolvedAt: number | null = null;
  return {
    id: "rules",
    label: "Rules",
    isRemote: false,
    dataNotice: null,
    decide: async (input: PolicyInput): Promise<Decision> => {
      const intent = intents[input.stepIndex];
      if (intent === undefined) {
        return { operation: "done", confidence: 1, reason: "intent list exhausted" };
      }
      if (input.stepIndex !== lastIntentIndex) {
        lastIntentIndex = input.stepIndex;
        firstUnresolvedAt = null;
      }
      if (input.observation.signals.pendingRequests > 0) {
        return {
          operation: "wait",
          confidence: 1,
          reason: `waiting: ${input.observation.signals.pendingRequests} requests pending`,
        };
      }
      return decideIntent(intent, input, {
        settleBudgetMs,
        fallbackConfidence,
        now: now(),
        markUnresolved: () => {
          if (firstUnresolvedAt === null) {
            firstUnresolvedAt = now();
          }
          return firstUnresolvedAt;
        },
      });
    },
  };
}

/** Per-decision context for intent resolution. */
interface IntentContext {
  settleBudgetMs: number;
  fallbackConfidence: number;
  now: number;
  markUnresolved: () => number;
}

/**
 * Maps one intent to a decision against the live observation.
 */
function decideIntent(intent: RuleIntent, input: PolicyInput, context: IntentContext): Decision {
  switch (intent.op) {
    case "wait":
      return {
        operation: "wait",
        confidence: 1,
        reason: `explicit wait of ${intent.durationMs} ms`,
      };
    case "back":
      return { operation: "back", confidence: 1, reason: `intent ${intent.id}: back` };
    case "pressKey":
      return {
        operation: "pressKey",
        text: intent.keycode,
        confidence: 1,
        reason: `intent ${intent.id}: press ${intent.keycode}`,
      };
    case "openApp":
      return {
        operation: "openApp",
        text: intent.packageName,
        confidence: 1,
        reason: `intent ${intent.id}: open ${intent.packageName}`,
      };
    case "swipe":
    case "scroll":
      return {
        operation: "blocked",
        confidence: 1,
        reason: `intent ${intent.id}: operation "${intent.op}" needs a gesture a single-target decision cannot express; author it as a manual flow step`,
      };
    case "tap":
    case "longPress":
    case "type": {
      if (intent.target === undefined) {
        return {
          operation: "blocked",
          confidence: 1,
          reason: `intent ${intent.id}: operation "${intent.op}" needs a target`,
        };
      }
      const resolution = resolveTarget(intent.target, input.observation);
      if (resolution.ok && resolution.strategy !== "point") {
        const confidence = resolution.strategy === "text" ? context.fallbackConfidence : 1;
        return {
          operation: intent.op,
          target: intent.target,
          text: intent.op === "type" ? intent.text : undefined,
          confidence,
          reason: `intent ${intent.id}: resolved through ${resolution.strategy}`,
        };
      }
      if (resolution.ok) {
        return {
          operation: intent.op,
          target: intent.target,
          text: intent.op === "type" ? intent.text : undefined,
          confidence: context.fallbackConfidence,
          reason: `intent ${intent.id}: resolved to a raw point, a weak target`,
        };
      }
      const firstMissedAt = context.markUnresolved();
      if (context.now - firstMissedAt <= context.settleBudgetMs) {
        return {
          operation: "wait",
          confidence: 1,
          reason: `intent ${intent.id}: target unsettled, ${resolution.reason}`,
        };
      }
      return {
        operation: "blocked",
        confidence: 1,
        reason: `intent ${intent.id}: target unresolvable after the settle budget, ${resolution.reason}`,
      };
    }
  }
  return {
    operation: "blocked",
    confidence: 1,
    reason: "unsupported intent",
  };
}

/**
 * Reads an intent list from registry factory options. Non-array options
 * yield an empty policy rather than a throw.
 */
function readIntents(options: unknown): RuleIntent[] {
  return Array.isArray(options) ? (options as RuleIntent[]) : [];
}

registerPolicy("rules", (options?: unknown) => createRulesPolicy(readIntents(options)));
