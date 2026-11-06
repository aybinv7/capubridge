import { computed, ref, type Ref } from "vue";
import { toast } from "@/lib/toast";
import { useAdb } from "@/composables/useAdb";
import type { AdbPackage } from "@/types/adb.types";
import { appDisplayName } from "@/shared/apps/appIdentity";
import {
  appActionCommand,
  appActionOutcome,
  appActionRequest,
  type AppAction,
  type AppActionSubject,
} from "@/shared/apps/appActions";

function subjectOf(app: AdbPackage): AppActionSubject {
  return { name: appDisplayName(app), packageName: app.packageName, system: app.system };
}

interface AppActionHooks {
  onUninstalled: (app: AdbPackage) => Promise<void> | void;
  onDataCleared: (app: AdbPackage) => void;
}

/**
 * Launch, force stop, clear data and uninstall for one phone. Disruptive actions are asked first:
 * `request` opens the question, `confirm` runs the shell command and reports what the phone said.
 */
export function useAppActions(serial: Ref<string>, hooks: AppActionHooks) {
  const { openPackage, shellCommand } = useAdb();
  const pending = ref<{ app: AdbPackage; action: AppAction } | null>(null);
  const isActing = ref(false);

  const confirmOpen = computed({
    get: () => pending.value !== null,
    set: (open: boolean) => {
      if (!open) pending.value = null;
    },
  });
  const confirmRequest = computed(() =>
    pending.value ? appActionRequest(pending.value.action, subjectOf(pending.value.app)) : null,
  );

  async function launch(app: AdbPackage) {
    if (!serial.value) return;
    const name = appDisplayName(app);
    try {
      await openPackage(serial.value, app.packageName);
      toast.success(`${name} opened on the phone`);
    } catch (err) {
      toast.error(`Could not open ${name}`, { description: String(err) });
    }
  }

  function request(app: AdbPackage, action: AppAction) {
    pending.value = { app, action };
  }

  async function confirm() {
    const current = pending.value;
    pending.value = null;
    if (!current || !serial.value) return;
    const { app, action } = current;
    const subject = subjectOf(app);
    const name = subject.name;
    isActing.value = true;
    try {
      const output = await shellCommand(serial.value, appActionCommand(action, subject));
      const outcome = appActionOutcome(action, subject, output);
      if (!outcome.ok) {
        toast.error(outcome.title, { description: outcome.description });
        return;
      }
      toast.success(outcome.title);
      if (action === "uninstall") await hooks.onUninstalled(app);
      if (action === "clearData") hooks.onDataCleared(app);
    } catch (err) {
      toast.error(`Could not finish the action on ${name}`, { description: String(err) });
    } finally {
      isActing.value = false;
    }
  }

  return { launch, request, confirm, confirmOpen, confirmRequest, isActing };
}
