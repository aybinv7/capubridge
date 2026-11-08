import { Copy, Link, RefreshCw } from "lucide-vue-next";
import { toast } from "@/lib/toast";
import { isNativeAppTarget } from "@/lib/app-target";
import { useCDP } from "@/composables/useCDP";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetsStore } from "@/stores/targets.store";

/** Commands about the device and WebView in use, offered from anywhere. */
export function useContextCommands(): void {
  const context = useActiveContextStore();
  const targets = useTargetsStore();
  const { getClient } = useCDP();

  async function copy(text: string, done: string, failed: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch (error) {
      toast.error(failed, { description: String(error) });
    }
  }

  async function reloadWebView() {
    const id = targets.cdpTargetId;
    const client = id ? getClient(id) : undefined;
    if (!client) {
      toast.error("Could not reload the WebView", {
        description: "The connection to its DevTools is closed.",
      });
      return;
    }
    try {
      await client.send("Page.reload", { ignoreCache: false });
    } catch (error) {
      toast.error("Could not reload the WebView", { description: String(error) });
    }
  }

  useCommandProvider("core.context", () => {
    const device = context.device;
    const target = context.target;
    const url = target?.url?.trim() ?? "";
    return [
      {
        id: "context.copy-serial",
        title: "Copy the device serial",
        group: "Devices" as const,
        icon: Copy,
        keywords: ["adb", "id", "clipboard"],
        when: () => device !== null,
        run: () =>
          device
            ? copy(device.serial, "Device serial copied", "Could not copy the serial")
            : undefined,
      },
      {
        id: "context.copy-url",
        title: "Copy the WebView address",
        group: "Targets" as const,
        icon: Link,
        keywords: ["url", "link", "page", "target", "clipboard"],
        when: () => url !== "" && !isNativeAppTarget(target),
        run: () => copy(url, "Address copied", "Could not copy the address"),
      },
      {
        id: "context.reload-webview",
        title: "Reload the WebView",
        group: "Targets" as const,
        icon: RefreshCw,
        keywords: ["refresh", "page", "app", "reload"],
        when: () => context.isTargetConnected && targets.cdpTargetId !== "",
        run: reloadWebView,
      },
    ];
  });
}
