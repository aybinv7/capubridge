import { toast } from "vue-sonner";
import { useConnectionStore } from "@/stores/connection.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { CDPTarget } from "@/types/cdp.types";

/** Single entry point for making a target the active one, shared by every surface that selects targets. */
export function useTargetActivation() {
  const connectionStore = useConnectionStore();
  const localWebviewStore = useLocalWebviewStore();
  const mirrorStore = useMirrorStore();
  const targetsStore = useTargetsStore();

  async function releasePrevious(nextId: string) {
    const previousId = connectionStore.selectedTargetId;
    if (previousId && previousId !== nextId) {
      await connectionStore.disconnectTarget(previousId);
    }
  }

  async function warmLocalTarget(targetId: string) {
    const target = targetsStore.targets.find((entry) => entry.id === targetId);
    if (!target || target.source !== "local") return;
    try {
      const readyTarget = await localWebviewStore.ensureCdpTarget(target);
      await connectionStore.connect(readyTarget);
      if (targetsStore.selectedTarget?.id === targetId) {
        targetsStore.selectTarget(readyTarget);
      }
    } catch (error) {
      toast.error("Local DevTools connection failed", { description: String(error) });
    }
  }

  async function activateLocalTarget(target: CDPTarget) {
    await releasePrevious(target.id);
    targetsStore.selectTarget(target);
    await localWebviewStore.ensureWebview(target);
    mirrorStore.open();
    void warmLocalTarget(target.id);
  }

  async function activateRemoteTarget(target: CDPTarget) {
    await releasePrevious(target.id);
    connectionStore.clearExternalDevtoolsTarget(target.id);
    targetsStore.selectTarget(target);
    await connectionStore.connect(target);
  }

  async function activateTarget(target: CDPTarget) {
    if (target.source === "local") {
      await activateLocalTarget(target);
      return;
    }
    await activateRemoteTarget(target);
  }

  return { activateTarget, activateLocalTarget, activateRemoteTarget };
}
