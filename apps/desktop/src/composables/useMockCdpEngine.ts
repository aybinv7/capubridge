import { FetchDomain } from "@capubridge/cdp-protocol";
import type { CDPClient, RequestPausedEvent } from "@capubridge/cdp-protocol";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import { MOCKABLE_RESOURCE_TYPES } from "@/types/mock.types";
import { answerHeaders, encodedBody } from "./mockCdpAnswer";

/** Answers matching requests inside one WebView through `Fetch.requestPaused`. */
export function useMockCdpEngine() {
  const store = useMockStore();
  let fetchDomain: FetchDomain | null = null;
  let unsubscribe: (() => void) | null = null;

  async function start(client: CDPClient) {
    await stop();
    const domain = new FetchDomain(client);
    fetchDomain = domain;
    unsubscribe = domain.onRequestPaused((event) => {
      void answer(domain, event);
    });
    await domain.enable({
      patterns: MOCKABLE_RESOURCE_TYPES.map((resourceType) => ({
        requestStage: "Request" as const,
        resourceType,
      })),
    });
  }

  async function stop() {
    unsubscribe?.();
    unsubscribe = null;
    const domain = fetchDomain;
    fetchDomain = null;
    if (domain) {
      await domain.disable().catch((error: unknown) => {
        console.warn("Failed to disable CDP request interception", error);
      });
    }
  }

  async function passOn(domain: FetchDomain, requestId: string) {
    await domain.continueRequest({ requestId }).catch((error: unknown) => {
      console.warn("Failed to continue intercepted request", requestId, error);
    });
  }

  async function answer(domain: FetchDomain, event: RequestPausedEvent) {
    const { method, url } = event.request;
    const matched = store.findMatchingRule(method, url);
    const mocked = matched !== null && !matched.passThrough;
    store.addLogEntry({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      method,
      url,
      matchedRuleId: matched?.id ?? null,
      matchedRuleName: matched?.name ?? null,
      responseStatus: mocked ? matched.statusCode : null,
      mode: "cdp",
      delayApplied: mocked ? matched.delayMs : 0,
      passedThrough: !mocked,
      noMatch: !matched,
    });
    if (matched) store.incrementHitCount(matched.id);
    if (!mocked) {
      await passOn(domain, event.requestId);
      return;
    }
    if (matched.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, matched.delayMs));
    await domain
      .fulfillRequest({
        requestId: event.requestId,
        responseCode: matched.statusCode,
        responseHeaders: answerHeaders(matched, event.request.headers),
        body: encodedBody(matched),
      })
      .catch(async (error: unknown) => {
        console.warn("Failed to fulfill mocked request; continuing original request", error);
        await passOn(domain, event.requestId);
      });
  }

  return { start, stop };
}
