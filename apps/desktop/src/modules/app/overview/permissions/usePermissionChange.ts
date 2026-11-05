import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { AppPermission } from "@/types/app-inspector.types";
import { useAppSession } from "../../appSession";
import {
  permissionChangeCommand,
  permissionChangeFailed,
  permissionLabel,
} from "./permissionsView";

/**
 * Allows or denies one runtime permission with `pm grant` / `pm revoke`. Denying asks first,
 * because Android stops the app when a permission is taken away; the dump is read again after.
 */
export function usePermissionChange() {
  const { app, dump, process } = useAppSession();
  const { shellCommand } = useAdb();
  const pending = ref<AppPermission | null>(null);
  const changing = ref<string | null>(null);

  const confirmOpen = computed({
    get: () => pending.value !== null,
    set: (open: boolean) => {
      if (!open) pending.value = null;
    },
  });
  const confirmRequest = computed<ConfirmRequest | null>(() =>
    pending.value
      ? {
          title: `Deny ${permissionLabel(pending.value.shortName)} to ${app.name.value}?`,
          text: "Android stops the app when a permission is taken away. It asks again the next time the app needs it.",
          confirmLabel: "Deny",
          danger: true,
        }
      : null,
  );

  async function apply(permission: AppPermission, grant: boolean) {
    const subject = app.subject.value;
    if (!subject || changing.value) return;
    const label = permissionLabel(permission.shortName);
    const command = permissionChangeCommand(subject.packageName, permission.name, grant);
    if (!command) {
      toast.error(`Could not change ${label}`, {
        description: "The permission name is not valid.",
      });
      return;
    }
    changing.value = permission.name;
    try {
      const output = await shellCommand(subject.serial, command);
      const failure = permissionChangeFailed(output);
      if (failure) {
        toast.error(`Could not change ${label}`, { description: failure });
        return;
      }
      toast.success(grant ? `${label} allowed` : `${label} denied`);
    } catch (err) {
      toast.error(`Could not change ${label}`, { description: String(err) });
    } finally {
      changing.value = null;
      await dump.query.refetch();
      if (!grant) process.readNow();
    }
  }

  function change(permission: AppPermission) {
    if (permission.granted) pending.value = permission;
    else void apply(permission, true);
  }

  function confirm() {
    const permission = pending.value;
    pending.value = null;
    if (permission) void apply(permission, false);
  }

  return { change, confirm, confirmOpen, confirmRequest, changing };
}
