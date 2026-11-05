import { computed, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { appActionCommand, appActionOutcome, appActionRequest } from "@/shared/apps/appActions";
import { packageDumpKey } from "../package/usePackageDump";
import type { AppProcess } from "../process/useAppProcess";
import type { InspectedApp } from "../subject/useInspectedApp";
import { packageDetailsKey } from "../subject/useInspectedApp";
import { usageKeys } from "../usage/useAppUsage";
import { restartCommand, type LifecycleAction } from "./lifecycle";

/**
 * Open, restart, force stop and clear data for the inspected app. Force stop and clear data ask
 * first (`request`, then `confirm`); every outcome is said in a toast, and the readings that the
 * action changed are taken again.
 */
export function useAppLifecycle(app: InspectedApp, process: AppProcess) {
  const { openPackage, shellCommand } = useAdb();
  const queryClient = useQueryClient();
  const pending = ref<LifecycleAction | null>(null);
  const busy = ref(false);

  const inBackground = computed(() => app.presence.value === "background");
  const subject = computed(() => {
    const current = app.subject.value;
    return current
      ? {
          serial: current.serial,
          action: {
            name: app.name.value,
            packageName: current.packageName,
            system: app.entry.value?.system ?? false,
          },
        }
      : null;
  });

  const confirmOpen = computed({
    get: () => pending.value !== null,
    set: (open: boolean) => {
      if (!open) pending.value = null;
    },
  });
  const confirmRequest = computed(() =>
    pending.value && subject.value ? appActionRequest(pending.value, subject.value.action) : null,
  );

  async function run(task: () => Promise<void>) {
    if (busy.value) return;
    busy.value = true;
    try {
      await task();
    } finally {
      busy.value = false;
      process.readNow();
    }
  }

  async function launch(serial: string, packageName: string) {
    await openPackage(serial, packageName);
    app.probePresence();
  }

  function open() {
    const current = subject.value;
    if (!current) return Promise.resolve();
    const bringing = inBackground.value;
    return run(async () => {
      try {
        await launch(current.serial, current.action.packageName);
        if (!bringing) toast.success(`${current.action.name} opened on the phone`);
      } catch (err) {
        toast.error(`Could not open ${current.action.name}`, { description: String(err) });
      }
    });
  }

  function restart() {
    const current = subject.value;
    if (!current) return Promise.resolve();
    return run(async () => {
      try {
        await shellCommand(current.serial, restartCommand(current.action.packageName));
        await launch(current.serial, current.action.packageName);
        toast.success(`${current.action.name} restarted`);
      } catch (err) {
        toast.error(`Could not restart ${current.action.name}`, { description: String(err) });
      }
    });
  }

  function request(action: LifecycleAction) {
    if (subject.value) pending.value = action;
  }

  function confirm() {
    const action = pending.value;
    const current = subject.value;
    pending.value = null;
    if (!action || !current) return Promise.resolve();
    return run(async () => {
      try {
        const output = await shellCommand(current.serial, appActionCommand(action, current.action));
        const outcome = appActionOutcome(action, current.action, output);
        if (!outcome.ok) {
          toast.error(outcome.title, { description: outcome.description });
          return;
        }
        toast.success(outcome.title);
        if (action === "clearData") await forgetAppData();
      } catch (err) {
        toast.error(`Could not finish the action on ${current.action.name}`, {
          description: String(err),
        });
      }
    });
  }

  async function forgetAppData() {
    const current = app.subject.value;
    const keys = usageKeys(current);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: packageDetailsKey(current) }),
      queryClient.invalidateQueries({ queryKey: packageDumpKey(current) }),
      queryClient.invalidateQueries({ queryKey: keys.network }),
      queryClient.invalidateQueries({ queryKey: keys.battery }),
    ]);
  }

  return {
    busy,
    inBackground,
    open,
    restart,
    request,
    confirm,
    confirmOpen,
    confirmRequest,
  };
}

export type AppLifecycle = ReturnType<typeof useAppLifecycle>;
