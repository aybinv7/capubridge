import type { PolicyOption } from "./agentPanelState";

const STORAGE_KEY = "capubridge.agent.remote-policy-consent.v1";

export function hasRemotePolicyConsent(policy: PolicyOption): boolean {
  if (!policy.isRemote || policy.dataNotice === null || typeof window === "undefined") {
    return !policy.isRemote;
  }
  try {
    return window.localStorage.getItem(`${STORAGE_KEY}.${policy.id}`) === policy.dataNotice;
  } catch {
    return false;
  }
}

export function saveRemotePolicyConsent(policy: PolicyOption): void {
  if (!policy.isRemote || policy.dataNotice === null || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(`${STORAGE_KEY}.${policy.id}`, policy.dataNotice);
  } catch {
    return;
  }
}
