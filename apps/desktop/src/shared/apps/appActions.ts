import type { ConfirmRequest } from "@/shared/components/presentation/confirm";

export type AppAction = "forceStop" | "clearData" | "uninstall";

/** The app an action is about: what to call it, and whether it came with the phone. */
export interface AppActionSubject {
  name: string;
  packageName: string;
  system: boolean;
}

/** The word on the uninstall button: system apps can only be removed for the current user. */
export function uninstallLabel(system: boolean): string {
  return system ? "Remove for this user" : "Uninstall";
}

/**
 * The shell command behind each app action. A system app cannot be uninstalled from the system
 * image, so it is removed for the current user instead.
 */
export function appActionCommand(action: AppAction, subject: AppActionSubject): string {
  const pkg = subject.packageName;
  if (action === "forceStop") return `am force-stop ${pkg}`;
  if (action === "clearData") return `pm clear ${pkg}`;
  return subject.system ? `pm uninstall --user current ${pkg}` : `pm uninstall ${pkg}`;
}

/** What the confirmation asks, in plain words. */
export function appActionRequest(action: AppAction, subject: AppActionSubject): ConfirmRequest {
  const name = subject.name;
  if (action === "forceStop") {
    return {
      title: `Force stop ${name}?`,
      text: "Android ends the app's process right away. Unsaved work in the app is lost.",
      confirmLabel: "Force stop",
      danger: false,
    };
  }
  if (action === "clearData") {
    return {
      title: `Clear the data of ${name}?`,
      text: "Deletes the app's data and cache on the phone, as if it was just installed.",
      confirmLabel: "Clear data",
      danger: true,
    };
  }
  if (subject.system) {
    return {
      title: `Remove ${name} for this user?`,
      text: 'It came with the phone, so Android keeps a copy in the system. It disappears for this user with its data, and comes back after a factory reset or with "cmd package install-existing".',
      confirmLabel: "Remove for this user",
      danger: true,
    };
  }
  return {
    title: `Uninstall ${name}?`,
    text: "Removes the app and all of its data from the phone.",
    confirmLabel: "Uninstall",
    danger: true,
  };
}

export interface AppActionOutcome {
  ok: boolean;
  title: string;
  description?: string;
}

/**
 * Reads what the shell said. `pm` prints "Success" when it worked; `am force-stop` prints
 * nothing, so it is taken at its word.
 */
export function appActionOutcome(
  action: AppAction,
  subject: AppActionSubject,
  output: string,
): AppActionOutcome {
  const name = subject.name;
  if (action === "forceStop") return { ok: true, title: `${name} was stopped` };
  const ok = output.toLowerCase().includes("success");
  if (action === "clearData") {
    return ok
      ? { ok, title: `Data of ${name} cleared` }
      : { ok, title: "Could not clear the data", description: output.trim() };
  }
  if (subject.system) {
    return ok
      ? { ok, title: `${name} removed for this user` }
      : { ok, title: `Could not remove ${name}`, description: output.trim() };
  }
  return ok
    ? { ok, title: `${name} uninstalled` }
    : { ok, title: "Could not uninstall", description: output.trim() };
}
