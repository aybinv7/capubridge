import { computed, ref, shallowRef, type Ref } from "vue";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { AppPermission, AppPermissionsData } from "@/types/app-inspector.types";
import type { AppSubject } from "../../subject/subject.types";
import {
  permissionChangeCommand,
  permissionChangeFailed,
  permissionLabel,
} from "./permissionsView";

/** What a permission change needs from the App session. */
export interface PermissionChangeDeps {
  subject: Readonly<Ref<AppSubject | null>>;
  appName: Readonly<Ref<string>>;
  /** The Android user the app runs as. */
  user: Readonly<Ref<number>>;
  permissions: Readonly<Ref<AppPermissionsData | null>>;
  /** Reads the package dump again and resolves once the new permissions are in. */
  reread: () => Promise<unknown>;
  /** Reads the process again: denying a permission stops the app. */
  readProcess: () => void;
}

/**
 * Allows or denies one runtime permission with `pm grant` / `pm revoke` for the app's user.
 * Denying asks first, because Android stops the app when a permission is taken away. The row
 * shows the asked-for state and stays busy until the permissions were read again, and the change
 * is only called done when Android actually reports the new state.
 */
export function usePermissionChange(deps: PermissionChangeDeps) {
  const { shellCommand } = useAdb();
  const pending = ref<AppPermission | null>(null);
  const changing = ref<string | null>(null);
  const optimistic = shallowRef<{ name: string; granted: boolean } | null>(null);

  const confirmOpen = computed({
    get: () => pending.value !== null,
    set: (open: boolean) => {
      if (!open) pending.value = null;
    },
  });
  const confirmRequest = computed<ConfirmRequest | null>(() =>
    pending.value
      ? {
          title: `Deny ${permissionLabel(pending.value.shortName)} to ${deps.appName.value}?`,
          text: "Android stops the app when a permission is taken away. It asks again the next time the app needs it.",
          confirmLabel: "Deny",
          danger: true,
        }
      : null,
  );

  function stateAfter(name: string): boolean | null {
    const found = deps.permissions.value?.runtime.find((permission) => permission.name === name);
    return found ? found.granted : null;
  }

  async function rereadQuietly() {
    try {
      await deps.reread();
    } catch (err) {
      console.warn("Could not read the app's permissions again", err);
    }
  }

  async function apply(permission: AppPermission, grant: boolean) {
    const subject = deps.subject.value;
    if (!subject) return;
    const label = permissionLabel(permission.shortName);
    if (changing.value) {
      toast.info("Another permission is still being changed", {
        description: `Try ${label} again when it has finished.`,
      });
      return;
    }
    const command = permissionChangeCommand(
      subject.packageName,
      permission.name,
      grant,
      deps.user.value,
    );
    if (!command) {
      toast.error(`Could not change ${label}`, {
        description: "The permission name is not valid.",
      });
      return;
    }
    changing.value = permission.name;
    optimistic.value = { name: permission.name, granted: grant };
    let reread = false;
    try {
      const output = await shellCommand(subject.serial, command);
      const failure = permissionChangeFailed(output);
      if (failure) {
        toast.error(`Could not change ${label}`, { description: failure });
        return;
      }
      await deps.reread();
      reread = true;
      const now = stateAfter(permission.name);
      if (now !== grant) {
        toast.error(`Android kept ${label} ${now ? "allowed" : "denied"}`, {
          description:
            "The phone accepted the request but did not change the permission. Restricted permissions and apps built for Android 5 or older cannot be changed this way.",
        });
        return;
      }
      toast.success(grant ? `${label} allowed` : `${label} denied`);
    } catch (err) {
      toast.error(`Could not change ${label}`, { description: String(err) });
    } finally {
      if (!reread) await rereadQuietly();
      if (!grant) deps.readProcess();
      changing.value = null;
      optimistic.value = null;
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

  return { change, confirm, confirmOpen, confirmRequest, changing, optimistic };
}
