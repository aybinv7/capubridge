import { invokeCommand, listenEvent } from "@/runtime/ipc";
import type { MockServerRule } from "@/runtime/ipc/contracts/mock";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import type { MockRule } from "@/types/mock.types";

function serverRule(rule: MockRule): MockServerRule {
  return {
    id: rule.id,
    method: rule.method,
    url_pattern: rule.urlPattern,
    url_match_type: rule.urlMatchType,
    status_code: rule.statusCode,
    content_type: rule.contentType,
    response_headers: rule.responseHeaders.map((header): [string, string] => [
      header.name,
      header.value,
    ]),
    response_body: rule.responseBody,
    body_base64: rule.bodyEncoding === "base64",
    delay_ms: rule.delayMs,
  };
}

/** The local HTTP mock server in Rust: start, stop, rules and what it answered. */
export function useMockHttpEngine() {
  const store = useMockStore();
  let unlisten: (() => void) | null = null;

  async function start() {
    await stop();
    try {
      await invokeCommand("mock_server_start", { port: store.httpPort });
      store.httpServerRunning = true;
      unlisten = await listenEvent("mock-server-request", (event) => {
        const matched = event.ruleId
          ? (store.rules.find((rule) => rule.id === event.ruleId) ?? null)
          : null;
        store.addLogEntry({
          id: crypto.randomUUID(),
          timestamp: event.timestamp,
          method: event.method,
          url: event.url,
          matchedRuleId: matched?.id ?? null,
          matchedRuleName: matched?.name ?? null,
          responseStatus: event.statusCode,
          mode: "http",
          delayApplied: event.delayMs,
          passedThrough: false,
          noMatch: !matched,
        });
        if (matched) store.incrementHitCount(matched.id);
      });
      await sync(store.activeRules);
    } catch (error) {
      store.httpServerRunning = false;
      console.error("Failed to start HTTP mock server", error);
    }
  }

  async function stop() {
    unlisten?.();
    unlisten = null;
    try {
      await invokeCommand("mock_server_stop");
    } catch (error) {
      console.warn("Failed to stop HTTP mock server", error);
    }
    store.httpServerRunning = false;
  }

  /** Sends rule definitions to the server; pass-through rules answer nothing there, so they stay out. */
  async function sync(rules: readonly MockRule[]) {
    if (!store.httpServerRunning) return;
    try {
      await invokeCommand("mock_server_sync_rules", {
        rules: rules.filter((rule) => !rule.passThrough).map(serverRule),
      });
    } catch (error) {
      console.error("Failed to synchronize HTTP mock rules", error);
    }
  }

  return { start, stop, sync };
}
