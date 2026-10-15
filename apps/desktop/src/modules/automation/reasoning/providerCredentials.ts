import { invokeCommand } from "@/runtime/ipc/client";
import type { ReasoningProviderId } from "./providerTypes";

export interface ReasoningProviderCredentialStatus {
  provider: Exclude<ReasoningProviderId, "test">;
  configured: boolean;
}

type ConfigurableReasoningProvider = Exclude<ReasoningProviderId, "test">;

export function getReasoningProviderCredentialStatus(
  provider: ConfigurableReasoningProvider,
): Promise<ReasoningProviderCredentialStatus> {
  return invokeCommand("reasoning_provider_get_credential_status", { payload: { provider } });
}

export function saveReasoningProviderCredential(
  provider: ConfigurableReasoningProvider,
  apiKey: string,
): Promise<ReasoningProviderCredentialStatus> {
  return invokeCommand("reasoning_provider_set_credential", { payload: { provider, apiKey } });
}

export function deleteReasoningProviderCredential(
  provider: ConfigurableReasoningProvider,
): Promise<ReasoningProviderCredentialStatus> {
  return invokeCommand("reasoning_provider_delete_credential", { payload: { provider } });
}
