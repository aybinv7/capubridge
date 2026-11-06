import type { AssertionOptions } from "./assertions";
import type {
  Decision,
  FlowStep,
  Observation,
  ResolvedTarget,
  TargetRef,
} from "@/types/automation.types";
import type { ExecutorDeps } from "./flowExecutor";
import { defaultSleep } from "./flowShared";
import { groundAppPackage } from "./appGrounding";

/** Default long-press duration when a decision carries none. */
const DEFAULT_LONG_PRESS_MS = 500;

/** Default settle budget after an action, in milliseconds. */
export const DEFAULT_SETTLE_TIMEOUT_MS = 1000;

/** Default settle poll interval, in milliseconds. */
export const DEFAULT_SETTLE_POLL_MS = 100;

/** Default assertion budget for assert steps and trailing assertions. */
const DEFAULT_ASSERTION_TIMEOUT_MS = 5000;

/** Default assertion poll interval. */
const DEFAULT_ASSERTION_POLL_MS = 250;

/**
 * Performs the device action for one decision, resolving targets and
 * executing its transport. Post-action text verification belongs to the
 * executor's settled observation, so native typing does not trigger a second
 * UI dump before the normal settle read.
 */
export async function performAction(
  decision: Decision,
  step: FlowStep | undefined,
  observation: Observation,
  deps: ExecutorDeps,
): Promise<ResolvedTarget | null> {
  const serial = deps.deviceSerial;
  switch (decision.operation) {
    case "tap":
    case "longPress": {
      const target = requireTarget(decision, step?.id);
      const point = resolveOrThrow(target, observation, deps, step?.id);
      if (decision.operation === "tap") {
        const handledByWebview =
          target.kind === "selector" && deps.clickWebview !== undefined
            ? await deps.clickWebview(target)
            : false;
        if (!handledByWebview) {
          await deps.actions.tap(serial, point.x, point.y);
        }
        return {
          ...point,
          executor: handledByWebview ? "webview" : target.kind === "point" ? "point" : "device",
        };
      } else {
        await deps.actions.longPress(serial, point.x, point.y, longPressDuration(step));
        return { ...point, executor: target.kind === "point" ? "point" : "device" };
      }
    }
    case "type": {
      const target = requireTarget(decision, step?.id);
      const point = resolveOrThrow(target, observation, deps, step?.id);
      const text = step?.op === "type" ? step.text : (decision.text ?? throwMissingText(step?.id));
      const wroteThroughWebview =
        target.kind === "selector" && deps.writeText !== undefined
          ? await deps.writeText(target, text)
          : false;
      if (!wroteThroughWebview) {
        await deps.actions.tap(serial, point.x, point.y);
        await deps.actions.inputText(serial, text);
      }
      return {
        ...point,
        executor: wroteThroughWebview ? "webview" : target.kind === "point" ? "point" : "device",
      };
    }
    case "swipe": {
      if (step?.op !== "swipe") {
        throw new Error("swipe needs endpoints a single-target decision cannot express");
      }
      await deps.actions.swipe(serial, step.from, step.to, step.durationMs ?? 0);
      return { x: step.to.x, y: step.to.y, strategy: "point", executor: "device" };
    }
    case "scroll": {
      if (step?.op !== "scroll") {
        throw new Error("scroll needs direction and distance");
      }
      let origin: ResolvedTarget;
      if (step.target === undefined) {
        const size = await deps.actions.screenSize(serial);
        origin = { x: size.width / 2, y: size.height / 2, strategy: "point" };
      } else {
        origin = resolveOrThrow(step.target, observation, deps, step.id);
      }
      await deps.actions.scroll(serial, origin, step.direction, step.distance ?? 400);
      return { ...origin, executor: origin.strategy === "point" ? "point" : "device" };
    }
    case "pressKey": {
      const keycode =
        step?.op === "pressKey" ? step.keycode : (decision.text ?? throwMissingText(step?.id));
      await deps.actions.pressKey(serial, keycode);
      return null;
    }
    case "back": {
      await deps.actions.back(serial);
      return null;
    }
    case "openApp": {
      const selected = deps.appPackage?.trim() ?? "";
      const requested = step?.op === "openApp" ? step.packageName.trim() : "";
      if (requested !== "" && requested !== "com.example.app") {
        await deps.actions.openApp(serial, requested);
        return null;
      }
      if (selected !== "") {
        await deps.actions.openApp(serial, selected);
        return null;
      }
      if (requested === "com.example.app") {
        throw new Error(
          "openApp needs a selected app or an explicit package; replace the placeholder package",
        );
      }
      const raw =
        step?.op === "openApp" ? step.packageName : (decision.text ?? throwMissingText(step?.id));
      const grounded = groundAppPackage(raw, deps.installedPackages ?? []) ?? null;
      if (grounded === null) {
        throw new Error(
          `openApp needs a selected app (got ${JSON.stringify(raw)}); pick the app in the App section first`,
        );
      }
      await deps.actions.openApp(serial, grounded);
      return null;
    }
    case "wait": {
      const durationMs =
        step?.op === "wait" ? step.durationMs : (deps.settlePollMs ?? DEFAULT_SETTLE_POLL_MS);
      await (deps.sleep ?? defaultSleep)(durationMs);
      return null;
    }
    case "assert": {
      if (step?.op !== "assert") {
        throw new Error("assert needs an assertion a bare decision cannot carry");
      }
      const result = await deps.evaluateAssertion(
        step.assertion,
        { observe: () => deps.observe(), ...deps.evidence },
        {
          timeoutMs: step.timeoutMs ?? deps.assertionTimeoutMs ?? DEFAULT_ASSERTION_TIMEOUT_MS,
          pollMs: deps.assertionPollMs ?? DEFAULT_ASSERTION_POLL_MS,
        },
      );
      if (!result.passed) {
        throw new Error(result.observed);
      }
      return null;
    }
    case "done":
    case "blocked": {
      throw new Error(`cannot execute "${decision.operation}" as a device action`);
    }
    case "goal": {
      throw new Error("goal steps execute in the mixed loop (CB-53), not as device actions");
    }
  }
}

/**
 * Assertion budget for trailing assertions.
 */
export function assertionBudget(deps: ExecutorDeps): AssertionOptions {
  return {
    timeoutMs: deps.assertionTimeoutMs ?? DEFAULT_ASSERTION_TIMEOUT_MS,
    pollMs: deps.assertionPollMs ?? DEFAULT_ASSERTION_POLL_MS,
  };
}

/**
 * Resolves a target or throws a miss carrying the reason.
 */
function resolveOrThrow(
  target: TargetRef,
  observation: Observation,
  deps: ExecutorDeps,
  stepId: string | undefined,
): ResolvedTarget {
  const resolution = deps.resolveTarget(target, observation);
  if (!resolution.ok) {
    throw new Error(`step ${stepId ?? "goal"} cannot resolve its target: ${resolution.reason}`);
  }
  return { x: resolution.point.x, y: resolution.point.y, strategy: resolution.strategy };
}

/**
 * Reads the decision or step target, throwing when a targeting operation has none.
 */
function requireTarget(decision: Decision, stepId: string | undefined): TargetRef {
  if (decision.target === undefined) {
    throw new Error(`step ${stepId ?? "goal"} operation "${decision.operation}" needs a target`);
  }
  return decision.target;
}

/**
 * Long-press duration from the step, defaulting when a decision carries none.
 */
function longPressDuration(step: FlowStep | undefined): number {
  if (step?.op === "longPress" && step.durationMs !== undefined) {
    return step.durationMs;
  }
  return DEFAULT_LONG_PRESS_MS;
}

/**
 * Throws for a missing text parameter. Exists so the parameter read stays an expression.
 */
function throwMissingText(stepId: string | undefined): string {
  throw new Error(`step ${stepId ?? "goal"} needs text it does not carry`);
}
