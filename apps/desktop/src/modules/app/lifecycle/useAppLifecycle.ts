import { computed, ref, type Ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { toast } from "@/lib/toast";
import { useAdb } from "@/composables/useAdb";
import { isNativeAppTarget } from "@/lib/app-target";
import { appActionCommand, appActionOutcome, appActionRequest } from "@/shared/apps/appActions";
import { packageDumpKey } from "../package/usePackageDump";
import type { AppProcess } from "../process/useAppProcess";
import type { InspectedApp } from "../subject/useInspectedApp";
import { packageDetailsKey } from "../subject/useInspectedApp";
import { usageKeys } from "../usage/useAppUsage";
import { restartCommand, type LifecycleAction } from "./lifecycle";
import { useReattach, type PreviousPage } from "./useReattach";

const ACTION_WORDS: Record<string, string> = {
  open: "opening",
  restart: "restarting",
  forceStop: "stopping",
  clearData: "clearing",
};

/**
 * Open, restart, force stop and clear data for the inspected app. Force stop and clear data ask
 * first (`request`, then `confirm`); every outcome is said in a toast, the readings the action
 * changed are taken again, and DevTools is attached again when the app started anew. One action
 * runs at a time; another one asked for meanwhile is refused with a word, never dropped silently.
 */
export function useAppLifecycle(
  app: InspectedApp,
  process: AppProcess,
  flags: Readonly<Ref<{ system: boolean }>>,
) {
  const { openPackage, shellCommand } = useAdb();
  const queryClient = useQueryClient();
  const { reattach, linked } = useReattach();
  const pending = ref<LifecycleAction | null>(null);
  const running = ref<string | null>(null);
  const busy = computed(() => running.value !== null);

  const inBackground = computed(() => app.presence.value === "background");
  const subject = computed(() => {
    const current = app.subject.value;
    return current
      ? {
          serial: current.serial,
          action: {
            name: app.name.value,
            packageName: current.packageName,
            system: flags.value.system,
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

  async function run(action: string, task: () => Promise<void>) {
    if (running.value) {
      toast.info(`Still ${ACTION_WORDS[running.value] ?? "busy"}`, {
        description: "Try again when the current action on the app has finished.",
      });
      return;
    }
    running.value = action;
    try {
      await task();
    } finally {
      running.value = null;
      process.readNow();
    }
  }

  function previousPage(): PreviousPage | null {
    const target = app.target.value;
    return target ? { id: target.id, url: target.url ?? null } : null;
  }

  let attaching: Promise<void> | null = null;

  function attachAgain(
    name: string,
    serial: string,
    packageName: string,
    previous: PreviousPage | null,
  ): Promise<void> {
    if (isNativeAppTarget(app.target.value)) return Promise.resolve();
    attaching ??= reattach(serial, packageName, previous)
      .then((back) => {
        if (back) return;
        toast.info(`${name} has no page to attach to yet`, {
          description: "Use Reconnect in the strip above the screen once its page is back.",
        });
      })
      .catch((err) => {
        toast.error(`Could not attach DevTools to ${name} again`, { description: String(err) });
      })
      .finally(() => {
        attaching = null;
      });
    return attaching;
  }

  function open() {
    const current = subject.value;
    if (!current) return Promise.resolve();
    const bringing = inBackground.value;
    const previous = previousPage();
    const wasLinked = linked();
    return run("open", async () => {
      try {
        await openPackage(current.serial, current.action.packageName);
        app.probePresence();
        if (!bringing) toast.success(`${current.action.name} opened on the phone`);
      } catch (err) {
        toast.error(`Could not open ${current.action.name}`, { description: String(err) });
        return;
      }
      if (!wasLinked) {
        void attachAgain(current.action.name, current.serial, current.action.packageName, previous);
      }
    });
  }

  function restart() {
    const current = subject.value;
    if (!current) return Promise.resolve();
    const previous = previousPage();
    return run("restart", async () => {
      try {
        await shellCommand(current.serial, restartCommand(current.action.packageName));
        await openPackage(current.serial, current.action.packageName);
        app.probePresence();
        toast.success(`${current.action.name} restarted`);
      } catch (err) {
        toast.error(`Could not restart ${current.action.name}`, { description: String(err) });
        return;
      }
      void attachAgain(current.action.name, current.serial, current.action.packageName, previous);
    });
  }

  function request(action: LifecycleAction) {
    if (!subject.value) return;
    if (running.value) {
      toast.info(`Still ${ACTION_WORDS[running.value] ?? "busy"}`, {
        description: "Try again when the current action on the app has finished.",
      });
      return;
    }
    pending.value = action;
  }

  function confirm() {
    const action = pending.value;
    const current = subject.value;
    pending.value = null;
    if (!action || !current) return Promise.resolve();
    return run(action, async () => {
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
    running,
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
