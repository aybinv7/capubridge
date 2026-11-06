import { invokeCommand } from "@/runtime/ipc/client";
import type { DecisionTransport } from "./decisionClient";

/**
 * Desktop transport: Rust-side HTTP, so the key never reaches the WebView.
 * Rust picks the TypeSafe name over the OpenRouter slug when the configured
 * endpoint is TypeSafe's own API, and turns the opt-in features into headers.
 */
export const desktopDecisionTransport: DecisionTransport = {
  send: (request) =>
    invokeCommand("jev_decide", {
      payload: {
        body: request.body,
        typesafeModel: request.typesafeModel,
        dangerZone: request.dangerZone,
      },
    }),
};
