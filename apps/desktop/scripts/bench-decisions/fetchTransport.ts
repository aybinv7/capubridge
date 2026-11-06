import type { JsonValue } from "../../src/runtime/ipc/contracts/common.ts";
import type { DecisionTransport } from "../../src/modules/automation/decisions/decisionClient.ts";

const DANGER_ZONE_HEADERS: Record<string, string> = {
  images: "TypeSafe-Danger-Zone-Images",
  "long-context": "TypeSafe-Danger-Zone-Long-Context",
};

/** What one call cost in time, for the latency columns. */
export interface CallTiming {
  ms: number;
}

/**
 * The same contract as the desktop's Rust transport, over fetch: the OpenRouter
 * slug is swapped for TypeSafe's name on TypeSafe's own API, opt-in features
 * become headers, and failures carry the same prefixes the client classifies.
 * The key is held in this closure only and never logged.
 */
export function createFetchTransport(
  endpoint: string,
  apiKey: string,
  onTiming: (timing: CallTiming) => void,
): DecisionTransport {
  const typesafe = new URL(endpoint).hostname.endsWith("typesafe.ai");
  return {
    send: async (request) => {
      const body = { ...request.body };
      if (typesafe) {
        if (request.typesafeModel === null) {
          throw new Error("jev-unsupported: this model is not served by TypeSafe's own API");
        }
        body["model"] = request.typesafeModel;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      for (const feature of request.dangerZone) {
        const header = DANGER_ZONE_HEADERS[feature];
        if (header !== undefined) {
          headers[header] = "true";
        }
      }
      const started = performance.now();
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        throw new Error(
          `jev-transport: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      } finally {
        onTiming({ ms: performance.now() - started });
      }
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`jev-http-${response.status}: ${text.slice(0, 300)}`);
      }
      try {
        return JSON.parse(text) as JsonValue;
      } catch (error) {
        throw new Error("jev-malformed: the endpoint returned an unparsable body", {
          cause: error,
        });
      }
    },
  };
}
