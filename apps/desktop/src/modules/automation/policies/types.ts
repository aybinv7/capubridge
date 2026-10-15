import type { ActionBatch, Decision, Observation, StepRecord } from "@/types/automation.types";
import type { Candidate } from "../elementIndex";
import type { RedactedObservation } from "../redact";

/** Policies the workbench can drive. Rules first; neither remote policy is required. */
export type PolicyId = "rules" | "artemis" | "jev" | "embedded";

/** Input to a local policy, which may see the raw observation. */
export interface PolicyInput<ObservationT = Observation> {
  goal: string;
  observation: ObservationT;
  candidates: Candidate[];
  history: StepRecord[];
  stepIndex: number;
  stateFingerprint?: string;
}

/**
 * Input to a remote policy, which must only ever see the redacted
 * observation. The candidate labels still derive from the raw observation,
 * so a remote policy must re-derive its choice set from the redacted layers
 * (as Jev does) and never trust these labels in a payload.
 */
export type RemotePolicyInput = PolicyInput<RedactedObservation>;
/**
 * Contract every policy implements. Local policies decide from the raw
 * observation; remote policies decide from the redacted one, enforced by
 * the input type rather than by convention.
 */
export interface AgentPolicy<Input extends PolicyInput<unknown> = PolicyInput> {
  readonly id: PolicyId;
  readonly label: string;
  readonly isRemote: boolean;
  readonly dataNotice: string | null;
  decide(input: Input): Promise<Decision>;
  decideBatch?(input: Input): Promise<ActionBatch>;
}

/** A policy that runs locally. Nothing leaves the machine; the notice is null. */
export interface LocalPolicy extends AgentPolicy<PolicyInput> {
  readonly isRemote: false;
  readonly dataNotice: null;
}

/**
 * A policy that sends data off the machine. The notice is required and must
 * state plainly what leaves; a remote policy with a null notice is a type
 * error, so a policy added later cannot ship without its notice appearing.
 */
export interface RemotePolicy extends AgentPolicy<RemotePolicyInput> {
  readonly isRemote: true;
  readonly dataNotice: string;
}

/** Why a policy call failed, distinct from a policy answering blocked. */
export type PolicyDecisionFailure = "transport" | "rejected-target" | "timeout" | "malformed";

/**
 * A failed policy call. The executor distinguishes this from a blocked
 * answer: a failure counts toward consecutive-failure limits, a blocked
 * answer carries the policy's own reason.
 */
export class PolicyDecisionError extends Error {
  readonly failure: PolicyDecisionFailure;

  constructor(failure: PolicyDecisionFailure, message: string) {
    super(message);
    this.name = "PolicyDecisionError";
    this.failure = failure;
  }
}

/**
 * Factory producing a policy instance. Options are policy-specific and
 * untyped at the registry seam; each policy documents its own options.
 */
export type PolicyFactory = (options?: unknown) => AnyPolicy;

/** Any policy implementation, local or remote. */
export type AnyPolicy = AgentPolicy<PolicyInput> | AgentPolicy<RemotePolicyInput>;

/** Policy factories by id. Additive: each policy registers its own entry. */
export const policyRegistry = new Map<PolicyId, PolicyFactory>();

/**
 * Registers one policy factory. Later policies add entries; nothing here changes.
 */
export function registerPolicy(id: PolicyId, factory: PolicyFactory): void {
  policyRegistry.set(id, factory);
}
