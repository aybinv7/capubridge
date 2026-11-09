import { onScopeDispose, ref, watch, type Ref } from "vue";
import type { CDPClient } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import type { CDPTarget } from "@/types/cdp.types";

interface FrameTree {
  frameTree: { frame: { id: string; url: string } };
}

function readRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

export type ReloadKind = "normal" | "hard" | "empty-cache";

/**
 * The address a page on This PC is really at, followed live as it navigates (links, history,
 * client-side routes), whether it is loading, and the ways to move it: navigate, reload, hard
 * reload, or empty the cache and hard reload.
 */
export function useLocalPageAddress(
  target: Ref<CDPTarget | null>,
  afterReload: () => Promise<void>,
) {
  const localWebviewStore = useLocalWebviewStore();
  const { connectToTarget } = useCDP();
  const url = ref("");
  const loading = ref(false);

  let unsubscribers: Array<() => void> = [];
  let mainFrameId: string | null = null;
  let revision = 0;

  function detach() {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    mainFrameId = null;
  }

  async function clientFor(current: CDPTarget): Promise<CDPClient | null> {
    const ready = await localWebviewStore.ensureCdpTarget(current).catch((error) => {
      console.warn("The page on This PC has no DevTools endpoint yet", error);
      return null;
    });
    return ready?.webSocketDebuggerUrl ? connectToTarget(ready) : null;
  }

  function listen(client: CDPClient) {
    unsubscribers = [
      client.on("Page.frameNavigated", (payload) => {
        const frame = readRecord(readRecord(payload).frame);
        if (frame.parentId || typeof frame.url !== "string") return;
        if (typeof frame.id === "string") mainFrameId = frame.id;
        url.value = frame.url;
      }),
      client.on("Page.navigatedWithinDocument", (payload) => {
        const event = readRecord(payload);
        if (event.frameId !== mainFrameId || typeof event.url !== "string") return;
        url.value = event.url;
      }),
      client.on("Page.frameStartedLoading", (payload) => {
        if (readRecord(payload).frameId === mainFrameId) loading.value = true;
      }),
      client.on("Page.frameStoppedLoading", (payload) => {
        if (readRecord(payload).frameId === mainFrameId) loading.value = false;
      }),
    ];
  }

  async function follow(current: CDPTarget | null) {
    const attempt = ++revision;
    detach();
    loading.value = false;
    url.value = current?.url ?? "";
    if (current?.source !== "local") return;

    const client = await clientFor(current);
    if (!client || attempt !== revision) return;
    listen(client);
    try {
      await client.send("Page.enable", {});
      const tree = await client.send<FrameTree>("Page.getFrameTree", {});
      if (attempt !== revision) return;
      mainFrameId = tree.frameTree.frame.id;
      url.value = tree.frameTree.frame.url;
    } catch (error) {
      console.warn("Could not read the address of the page on This PC", error);
    }
  }

  watch(
    () => [target.value?.id ?? null, target.value?.webSocketDebuggerUrl ?? null] as const,
    () => void follow(target.value),
    { immediate: true },
  );

  onScopeDispose(() => {
    revision += 1;
    detach();
  });

  async function navigate(next: string) {
    const current = target.value;
    if (!current?.localWebviewLabel) throw new Error("No page on This PC is selected");
    url.value = next;
    const client = await clientFor(current);
    if (client) {
      const result = await client.send<{ errorText?: string }>("Page.navigate", { url: next });
      if (result.errorText) throw new Error(result.errorText);
      return;
    }
    await localWebviewStore.navigateSource(current.localWebviewLabel, next);
  }

  async function reload(kind: ReloadKind) {
    const current = target.value;
    if (!current?.localWebviewLabel) throw new Error("No page on This PC is selected");
    const client = await clientFor(current);
    if (!client) {
      await localWebviewStore.navigateSource(current.localWebviewLabel, url.value || current.url);
      return;
    }
    if (kind === "empty-cache") await client.send("Network.clearBrowserCache", {});
    await client.send("Page.reload", { ignoreCache: kind !== "normal" });
    await afterReload();
  }

  return { url, loading, navigate, reload };
}
