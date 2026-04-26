import { buildInjectionScript } from "@/lib/replay/rrweb-inject-script";
import type { CDPClient } from "utils";
import type { useSessionWriter } from "./useSessionWriter";
import { toast } from "vue-sonner";

type Writer = ReturnType<typeof useSessionWriter>;

const BINDING_NAME = "__capuEmit";

export function useRrwebRecorder(client: CDPClient, writer: Writer) {
  let scriptIdentifier: string | null = null;
  let cleanupHandler: (() => void) | null = null;
  let bindingCount = 0;
  let eventCount = 0;

  async function start(opts: { reloadTarget: boolean }) {
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
          timestamp: number;
          [k: string]: unknown;
        }>;
        eventCount += events.length;
        for (const event of events) {
          writer.pushAt("rrweb", event, event.timestamp);
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

    setTimeout(() => {
      if (eventCount === 0) {
        const msg = `rrweb: no events after 3s. Binding called ${bindingCount}x. Try reload toggle.`;
        console.warn("[rrweb]", msg);
        toast.warning(msg);
      }
    }, 3000);
  }

  async function stop() {
    console.log(`[rrweb] stop — captured ${eventCount} events in ${bindingCount} batches`);

    if (scriptIdentifier) {
      try {
        await client.send("Page.removeScriptToEvaluateOnNewDocument", {
          identifier: scriptIdentifier,
        });
      } catch {
        void 0;
      }
      scriptIdentifier = null;
    }

    try {
      await client.send("Runtime.removeBinding", { name: BINDING_NAME });
    } catch {
      void 0;
    }

    cleanupHandler?.();
    cleanupHandler = null;
  }

  return { start, stop };
}
