import { ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "@/lib/toast";
import { useUIStore } from "@/stores/ui.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { useLocalTabs } from "@/composables/useLocalTabs";
import { useAdb } from "@/composables/useAdb";
import { isNativeAppTarget, webviewPageOf } from "@/lib/app-target";
import type { GateActionId } from "@/lib/gates/types";

/** Runs the next step a gate offers. One action at a time; failures surface as toasts. */
export function useGateActions() {
  const ui = useUIStore();
  const router = useRouter();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const presenceStore = useTargetPresenceStore();
  const context = useActiveContextStore();
  const { activateTarget } = useTargetActivation();
  const { enterThisPc } = useLocalTabs();
  const { openPackage } = useAdb();
  const running = ref<GateActionId | null>(null);

  async function scanTargets() {
    const serial = context.device?.serial;
    if (!serial) {
      ui.openDeviceManager();
      return;
    }
    await targetsStore.fetchTargetsForSource({ type: "adb", serial });
    presenceStore.probeNow();
    if (targetsStore.error) throw new Error(targetsStore.error);
    const selected = context.target;
    if (selected && isNativeAppTarget(selected) && selected.packageName) {
      await switchToWebView(serial, selected.title, selected.packageName);
    }
  }

  async function switchToWebView(serial: string, title: string, packageName: string) {
    const page = webviewPageOf(targetsStore.targets, serial, packageName);
    if (page) {
      await activateTarget(page);
      return;
    }
    toast.info(`${title} still has no WebView`, {
      description: "Open a screen of the app that shows web content, then scan again.",
    });
  }

  async function attach() {
    const target = context.target;
    if (!target) {
      ui.openDeviceManager();
      return;
    }
    await activateTarget(target);
  }

  async function bringToFront() {
    const serial = context.device?.serial;
    const packageName = context.target?.packageName;
    if (!serial || !packageName) return;
    await openPackage(serial, packageName);
    presenceStore.probeNow();
  }

  const handlers: Record<GateActionId, () => void | Promise<void>> = {
    "choose-target": () => (context.kind === "local" ? enterThisPc() : ui.openDeviceManager()),
    "choose-device": () => ui.openDeviceManager("device"),
    "pair-wifi": () => ui.openDeviceManager("connect"),
    "start-emulator": () => ui.openDeviceManager("emulators"),
    "open-local-url": enterThisPc,
    "start-adb": () => devicesStore.refreshDevices(),
    "rescan-devices": () => devicesStore.refreshDevices(),
    "scan-targets": scanTargets,
    "open-sqlite": async () => {
      await router.push({ name: "storage-sqlite" });
    },
    connect: attach,
    reconnect: attach,
    "bring-to-front": bringToFront,
  };

  async function run(action: GateActionId, label: string) {
    if (running.value) return;
    running.value = action;
    try {
      await handlers[action]();
    } catch (error) {
      toast.error(`${label} failed`, { description: String(error) });
    } finally {
      running.value = null;
    }
  }

  return { run, running };
}
