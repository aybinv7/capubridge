import { buildInjectionScript } from "@/lib/replay/rrweb-inject-script";
import type { CDPClient } from "@capubridge/cdp-protocol";
import type { useSessionWriter } from "./useSessionWriter";
import { toast } from "vue-sonner";
import { recordingDeadline } from "./recordingDeadline";

type Writer = ReturnType<typeof useSessionWriter>;

const BINDING_NAME = "__capuEmit";

export function useRrwebRecorder(client: CDPClient, writer: Writer) {
  let scriptIdentifier: string | null = null;
  let cleanupHandler: (() => void) | null = null;
  let bindingCount = 0;
  let eventCount = 0;
  let started = false;
  let bindingAdded = false;
  let warningTimer: ReturnType<typeof setTimeout> | null = null;

  async function start(opts: { reloadTarget: boolean }) {
    if (started) return;
    bindingCount = 0;
    eventCount = 0;
    console.log("[rrweb] start: enabling Page+Runtime domains");
    try {
      await client.send("Page.enable", {});
    } catch (e) {
      const msg = `Page.enable failed: ${String(e)}`;
      console.error("[rrweb]", msg);
      toast.error(msg);
      throw e;
    }
    try {
      await client.send("Runtime.enable", {});
    } catch (e) {
      const msg = `Runtime.enable failed: ${String(e)}`;
      console.error("[rrweb]", msg);
      toast.error(msg);
      throw e;
    }

    console.log("[rrweb] adding binding", BINDING_NAME);
    try {
      await client.send("Runtime.addBinding", { name: BINDING_NAME });
      bindingAdded = true;
    } catch (e) {
      const msg = `Runtime.addBinding failed: ${String(e)}`;
      console.error("[rrweb]", msg);
      toast.error(msg);
      throw e;
    }

    const script = buildInjectionScript();
    console.log(`[rrweb] injecting script (${script.length} chars)`);
    try {
      const response = await client.send<{ identifier: string }>(
        "Page.addScriptToEvaluateOnNewDocument",
        { source: script },
      );
      scriptIdentifier = response.identifier;
      console.log("[rrweb] script registered, identifier =", scriptIdentifier);
    } catch (e) {
      const msg = `Page.addScriptToEvaluateOnNewDocument failed: ${String(e)}`;
      console.error("[rrweb]", msg);
      toast.error(msg);
      throw e;
    }

    const handler = (params: unknown) => {
      const p = params as { name: string; payload: string };
      if (p.name !== BINDING_NAME) return;
      bindingCount++;
      try {
        const events = JSON.parse(p.payload) as Array<{
          timestamp?: number;
          __capuTruncated?: boolean;
          droppedEvents?: number;
          __capuError?: string;
          [k: string]: unknown;
        }>;
        const recordedEvents = events.filter(
          (event) => !event.__capuTruncated && !event.__capuError,
        );
        const recorderError = events.find((event) => event.__capuError)?.__capuError;
        if (recorderError) toast.error(`rrweb capture failed: ${recorderError}`);
        const droppedEvents = events.find((event) => event.__capuTruncated)?.droppedEvents ?? 0;
        if (droppedEvents > 0) {
          toast.warning(`rrweb dropped ${droppedEvents} buffered events before binding recovered`);
        }
        eventCount += recordedEvents.length;
        for (const event of recordedEvents) {
          writer.pushAt("rrweb", event, event.timestamp ?? Date.now());
        }
        if (bindingCount === 1) {
          console.log(`[rrweb] first batch received (${events.length} events)`);
          toast.success(`rrweb capturing — ${events.length} events`);
        }
      } catch (err) {
        console.error("[rrweb] failed to parse batch", err);
      }
    };

    cleanupHandler = client.on("Runtime.bindingCalled", handler);

    if (opts.reloadTarget) {
      console.log("[rrweb] reloading target");
      try {
        await client.send("Page.reload", { ignoreCache: true });
        toast.info("Target reloaded for clean rrweb snapshot");
      } catch (e) {
        const msg = `Page.reload failed: ${String(e)}`;
        console.error("[rrweb]", msg);
        toast.error(msg);
      }
    } else {
      console.log("[rrweb] no-reload path: evaluating script in current document");
      try {
        const result = await client.send<{ exceptionDetails?: { text: string } }>(
          "Runtime.evaluate",
          { expression: script, awaitPromise: false, returnByValue: false },
        );
        if (result?.exceptionDetails) {
          const msg = `rrweb inline eval threw: ${result.exceptionDetails.text}`;
          console.error("[rrweb]", msg);
          toast.error(msg);
        } else {
          console.log("[rrweb] inline eval completed");
        }
      } catch (e) {
        const msg = `Runtime.evaluate failed: ${String(e)}`;
        console.error("[rrweb]", msg);
        toast.error(msg);
      }
    }

    started = true;
    warningTimer = setTimeout(() => {
      if (eventCount === 0) {
        const msg = `rrweb: no events after 3s. Binding called ${bindingCount}x. Try reload toggle.`;
        console.warn("[rrweb]", msg);
        toast.warning(msg);
      }
    }, 3000);
  }

  async function stop() {
    if (!started && !bindingAdded && !scriptIdentifier && !cleanupHandler) return;
    started = false;
    console.log(`[rrweb] stop — captured ${eventCount} events in ${bindingCount} batches`);

    if (warningTimer) {
      clearTimeout(warningTimer);
      warningTimer = null;
    }

    let targetStopError: unknown = null;
    try {
      const targetStop = await recordingDeadline(
        client.send<{
          exceptionDetails?: { text: string };
          result?: { value?: { truncated?: boolean } };
        }>("Runtime.evaluate", {
          expression:
            "typeof window.__capuStopRrweb === 'function' ? window.__capuStopRrweb() : ({ stopped: false, missing: true })",
          awaitPromise: true,
          returnByValue: true,
        }),
        "Target recorder shutdown",
        4000,
      );
      if (targetStop.exceptionDetails) {
        targetStopError = new Error(
          `Target recorder shutdown failed: ${targetStop.exceptionDetails.text}`,
        );
      }
      if (targetStop.result?.value?.truncated) {
        toast.warning("rrweb recording ended with truncated buffered events");
      }
    } catch (error) {
      targetStopError = error;
    }

    cleanupHandler?.();
    cleanupHandler = null;
    const identifier = scriptIdentifier;
    scriptIdentifier = null;
    const removeBinding = bindingAdded;
    bindingAdded = false;
    const cleanupResults = await Promise.allSettled([
      identifier
        ? recordingDeadline(
            client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier }),
            "Recorder script removal",
            4000,
          )
        : Promise.resolve(),
      removeBinding
        ? recordingDeadline(
            client.send("Runtime.removeBinding", { name: BINDING_NAME }),
            "Recorder binding removal",
            4000,
          )
        : Promise.resolve(),
    ]);
    const cleanupError = cleanupResults.find((result) => result.status === "rejected");
    if (targetStopError) throw targetStopError;
    if (cleanupError?.status === "rejected") throw cleanupError.reason;
  }

  return { start, stop };
}
