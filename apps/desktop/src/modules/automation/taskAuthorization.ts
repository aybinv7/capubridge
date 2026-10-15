import type {
  AutomationActionClass,
  AutomationAuthorizationScope,
  AutomationPrincipal,
  Decision,
  Flow,
  FlowStep,
  TargetRef,
} from "@/types/automation.types";

export interface AuthorizationRequest {
  principalId: string;
  deviceSerial: string;
  appPackage: string;
  actionClass: AutomationActionClass;
  stepId: string;
  occurredAt: number;
}

export type AuthorizationDecision =
  | { allowed: true; scopeId: string; actionClass: AutomationActionClass; stepId: string }
  | {
      allowed: false;
      scopeId: string | null;
      actionClass: AutomationActionClass;
      stepId: string;
      reason: string;
    };

export function authorizationScopeForGoal(
  goal: string,
  deviceSerial: string,
  appPackage: string | null,
  grantedAt: number,
): AutomationAuthorizationScope {
  const normalized = goal.toLowerCase();
  const actionClasses: AutomationActionClass[] = ["observe", "navigate", "input"];
  if (appPackage !== null) actionClasses.push("launch-app");
  if (/\b(confirm|place|submit|complete|pay)\b/.test(normalized)) actionClasses.push("confirm");
  return {
    id: `scope-${grantedAt.toString(36)}`,
    grantedAt,
    expiresAt: null,
    appPackages: appPackage === null ? [] : [appPackage],
    deviceSerials: [deviceSerial],
    actionClasses,
    finalCommitments: declaredQuantities(goal),
    remoteData: "redacted-observation",
  };
}

export function authorizeRequest(
  scope: AutomationAuthorizationScope | null,
  request: AuthorizationRequest,
  principal: AutomationPrincipal,
): AuthorizationDecision {
  if (scope === null) return denied(null, request, "task has no authorization scope");
  if (principal.id !== request.principalId)
    return denied(scope.id, request, "principal does not own this task");
  if (scope.expiresAt !== null && request.occurredAt > scope.expiresAt)
    return denied(scope.id, request, "authorization scope has expired");
  if (!scope.deviceSerials.includes(request.deviceSerial))
    return denied(scope.id, request, "device is outside the authorized scope");
  if (!scope.appPackages.includes(request.appPackage))
    return denied(scope.id, request, "app is outside the authorized scope");
  if (!scope.actionClasses.includes(request.actionClass))
    return denied(scope.id, request, "action class requires new authorization");
  return {
    allowed: true,
    scopeId: scope.id,
    actionClass: request.actionClass,
    stepId: request.stepId,
  };
}

export function authorizeFlow(
  scope: AutomationAuthorizationScope | null,
  principal: AutomationPrincipal,
  deviceSerial: string,
  flow: Flow,
  occurredAt: number,
): AuthorizationDecision {
  const fallback = requestFor(flow, flow.steps[0], deviceSerial, occurredAt, principal.id);
  if (scope === null) return denied(null, fallback, "task has no authorization scope");
  const declared = new Set(scope.finalCommitments);
  const supplied = numericInputs(flow);
  if (declared.size > 0 && supplied.some((value) => !declared.has(value))) {
    return denied(scope.id, fallback, "product quantity changes require new authorization");
  }
  for (const step of flow.steps) {
    const decision = authorizeRequest(
      scope,
      requestFor(flow, step, deviceSerial, occurredAt, principal.id),
      principal,
    );
    if (!decision.allowed) return decision;
  }
  const finalStep = flow.steps.at(-1);
  return {
    allowed: true,
    scopeId: scope.id,
    actionClass: finalStep === undefined ? "observe" : actionClassForStep(finalStep),
    stepId: finalStep?.id ?? "batch",
  };
}

export function actionClassForStep(step: FlowStep): AutomationActionClass {
  if (step.op === "openApp") return "launch-app";
  if (step.op === "type") return "input";
  if (step.op === "assert" || step.op === "wait") return "observe";
  return targetText(step).match(/\b(confirm|place order|submit|checkout|pay)\b/i) === null
    ? "navigate"
    : "confirm";
}

export function actionClassForDecision(decision: Decision): AutomationActionClass {
  if (decision.operation === "openApp") return "launch-app";
  if (decision.operation === "type") return "input";
  if (
    decision.operation === "assert" ||
    decision.operation === "wait" ||
    decision.operation === "done" ||
    decision.operation === "blocked"
  )
    return "observe";
  return targetLabel(decision.target).match(/\b(confirm|place order|submit|checkout|pay)\b/i) ===
    null
    ? "navigate"
    : "confirm";
}

function requestFor(
  flow: Flow,
  step: FlowStep | undefined,
  deviceSerial: string,
  occurredAt: number,
  principalId: string,
): AuthorizationRequest {
  return {
    principalId,
    deviceSerial,
    appPackage: flow.appPackage,
    actionClass: step === undefined ? "observe" : actionClassForStep(step),
    stepId: step?.id ?? "batch",
    occurredAt,
  };
}

function declaredQuantities(goal: string): string[] {
  return [...new Set(goal.match(/\b\d+(?:\.\d+)?\b/g) ?? [])];
}

function numericInputs(flow: Flow): string[] {
  return flow.steps.flatMap((step) =>
    step.op === "type" ? (step.text.match(/\b\d+(?:\.\d+)?\b/g) ?? []) : [],
  );
}

function targetText(step: FlowStep): string {
  if (!("target" in step) || step.target === undefined) return "";
  return targetLabel(step.target);
}

function targetLabel(target: TargetRef | null | undefined): string {
  if (target === null || target === undefined) return "";
  return target.kind === "text"
    ? target.text
    : target.kind === "selector"
      ? target.cssSelector
      : "";
}

function denied(
  scopeId: string | null,
  request: AuthorizationRequest,
  reason: string,
): Extract<AuthorizationDecision, { allowed: false }> {
  return {
    allowed: false,
    scopeId,
    actionClass: request.actionClass,
    stepId: request.stepId,
    reason,
  };
}
