import { computed, ref } from "vue";
import { CircleStop, Eraser, RotateCcw } from "lucide-vue-next";
import { toast } from "@/lib/toast";
import { isNativeAppTarget } from "@/lib/app-target";
import { targetAppName } from "@/lib/target-app-name";
import { useAdb } from "@/composables/useAdb";
import { useAppPackages } from "@/composables/useAppPackages";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { AdbPackage } from "@/types/adb.types";
import { useAppActions } from "@/shared/apps/useAppActions";
import { packageOfTarget } from "../subject/packageName";
import { restartCommand } from "./lifecycle";
import { useReattach } from "./useReattach";

interface ShellAppSubject {
  serial: string;
  packageName: string;
  name: string;
}

/**
 * Restart, force stop and clear data for the selected app from anywhere in the app, through the
 * palette. Force stop and clear data ask first (the host component draws the question); the App
 * screen offers the same commands and replaces these while it is open.
 */
export function useShellAppCommands() {
  const context = useActiveContextStore();
  const targets = useTargetsStore();
  const { openPackage, shellCommand } = useAdb();
  const { reattach } = useReattach();
  const restarting = ref(false);
  const deviceSerial = computed(() => context.device?.serial ?? "");
  const { getCachedPackage } = useAppPackages(deviceSerial);

  const subject = computed<ShellAppSubject | null>(() => {
    const target = targets.selectedTarget;
    const device = context.device;
    if (!target || target.source !== "adb" || !device || device.status !== "online") return null;
    if (device.isStale || target.deviceSerial !== device.serial) return null;
    const packageName = packageOfTarget(target.packageName);
    if (!packageName) return null;
    const label = getCachedPackage(packageName)?.label;
    return {
      serial: device.serial,
      packageName,
      name: targetAppName(target, label) ?? packageName,
    };
  });

  const serial = computed(() => subject.value?.serial ?? "");
  const actions = useAppActions(serial);

  function asPackage(current: ShellAppSubject): AdbPackage {
    return {
      packageName: current.packageName,
      apkPath: "",
      system: false,
      enabled: true,
      label: current.name,
    };
  }

  async function restart() {
    const current = subject.value;
    if (!current || restarting.value) return;
    restarting.value = true;
    const target = targets.selectedTarget;
    const previous = target ? { id: target.id, url: target.url ?? null } : null;
    try {
      await shellCommand(current.serial, restartCommand(current.packageName));
      await openPackage(current.serial, current.packageName);
      toast.success(`${current.name} restarted`);
    } catch (error) {
      toast.error(`Could not restart ${current.name}`, { description: String(error) });
      return;
    } finally {
      restarting.value = false;
    }
    if (isNativeAppTarget(target)) return;
    void reattach(current.serial, current.packageName, previous).catch((error: unknown) => {
      toast.error(`Could not attach DevTools to ${current.name} again`, {
        description: String(error),
      });
    });
  }

  useCommandProvider("app.shell", () => {
    const current = subject.value;
    if (!current) return [];
    return [
      {
        id: "app.restart",
        title: `Restart ${current.name}`,
        group: "App" as const,
        icon: RotateCcw,
        keywords: ["relaunch", "reload", "cold start"],
        run: restart,
      },
      {
        id: "app.force-stop",
        title: `Force stop ${current.name}`,
        group: "App" as const,
        icon: CircleStop,
        keywords: ["kill", "stop"],
        run: () => actions.request(asPackage(current), "forceStop"),
      },
      {
        id: "app.clear-data",
        title: `Clear the data of ${current.name}`,
        group: "App" as const,
        icon: Eraser,
        keywords: ["wipe", "reset", "pm clear"],
        run: () => actions.request(asPackage(current), "clearData"),
      },
    ];
  });

  return {
    confirmOpen: actions.confirmOpen,
    confirmRequest: actions.confirmRequest,
    confirm: actions.confirm,
  };
}
