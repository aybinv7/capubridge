import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { computed, effectScope, ref, shallowRef } from "vue";
import type { AppPermissionsData } from "@/types/app-inspector.types";
import { parsePermissions } from "../package/permissions";
import type { AppSubject } from "../subject/subject.types";
import { APP, PACKAGE_DUMP_TWO_USERS } from "./android16.fixtures";

const calls = vi.hoisted(() => ({
  shell: [] as string[],
  shellOutput: "",
  release: null as null | (() => void),
  toasts: [] as Array<{ kind: string; title: string }>,
}));

vi.mock("@/composables/useAdb", () => ({
  useAdb: () => ({
    shellCommand: async (_serial: string, command: string) => {
      calls.shell.push(command);
      if (calls.release) await new Promise<void>((resolve) => (calls.release = resolve));
      return calls.shellOutput;
    },
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (title: string) => calls.toasts.push({ kind: "success", title }),
    error: (title: string) => calls.toasts.push({ kind: "error", title }),
    info: (title: string) => calls.toasts.push({ kind: "info", title }),
  },
}));

const { usePermissionChange } = await import("../overview/permissions/usePermissionChange");

const scopes: Array<ReturnType<typeof effectScope>> = [];

/** The dump the phone sends after the change: CAMERA flipped for user 0 when `applies`. */
function dumpAfter(applies: boolean, granted: boolean): string {
  if (!applies) return PACKAGE_DUMP_TWO_USERS;
  return PACKAGE_DUMP_TWO_USERS.replace(
    "android.permission.CAMERA: granted=true, flags=[ USER_SET|",
    `android.permission.CAMERA: granted=${granted}, flags=[ USER_SET|`,
  );
}

function mount(options: { user?: number; applies?: boolean } = {}) {
  const permissions = shallowRef<AppPermissionsData | null>(
    parsePermissions(PACKAGE_DUMP_TWO_USERS, options.user ?? 0),
  );
  const readProcess = vi.fn();
  let rereads = 0;
  const reread = vi.fn(async () => {
    rereads += 1;
    permissions.value = parsePermissions(
      dumpAfter(options.applies ?? true, false),
      options.user ?? 0,
    );
  });
  const scope = effectScope();
  scopes.push(scope);
  const change = scope.run(() =>
    usePermissionChange({
      subject: ref<AppSubject | null>({ serial: "phone-a", packageName: APP }),
      appName: computed(() => "Retail"),
      user: computed(() => options.user ?? 0),
      permissions,
      reread,
      readProcess,
    }),
  );
  if (!change) throw new Error("scope did not run");
  const camera = () => permissions.value?.runtime.find((p) => p.shortName === "CAMERA");
  return { change, camera, reread, readProcess, rereads: () => rereads };
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  calls.shell.length = 0;
  calls.toasts.length = 0;
  calls.shellOutput = "";
  calls.release = null;
});

describe("usePermissionChange", () => {
  it("denying asks first, then revokes for the app's user and checks Android did it", async () => {
    const { change, camera, readProcess, rereads } = mount();
    const permission = camera();
    if (!permission) throw new Error("fixture has no camera");
    change.change(permission);
    expect(change.confirmOpen.value).toBe(true);
    expect(change.confirmRequest.value?.title).toBe("Deny Camera to Retail?");
    expect(calls.shell).toEqual([]);

    change.confirm();
    await vi.waitFor(() => expect(change.changing.value).toBeNull());
    expect(calls.shell).toEqual([`pm revoke --user 0 ${APP} android.permission.CAMERA`]);
    expect(rereads()).toBe(1);
    expect(readProcess).toHaveBeenCalled();
    expect(calls.toasts).toEqual([{ kind: "success", title: "Camera denied" }]);
  });

  it("the second user's permission is changed for that user", async () => {
    const { change } = mount({ user: 10 });
    const camera = parsePermissions(PACKAGE_DUMP_TWO_USERS, 10).runtime[0];
    if (!camera) throw new Error("fixture has no camera");
    change.change(camera);
    await vi.waitFor(() => expect(calls.shell).toHaveLength(1));
    expect(calls.shell[0]).toBe(`pm grant --user 10 ${APP} android.permission.CAMERA`);
  });

  it("a change Android ignored is reported as not done", async () => {
    const { change, camera } = mount({ applies: false });
    const permission = camera();
    if (!permission) throw new Error("fixture has no camera");
    change.change(permission);
    change.confirm();
    await vi.waitFor(() => expect(change.changing.value).toBeNull());
    expect(calls.toasts).toEqual([{ kind: "error", title: "Android kept Camera allowed" }]);
  });

  it("the row shows the asked-for state and stays busy until the re-read lands", async () => {
    const { change, camera } = mount();
    const permission = camera();
    if (!permission) throw new Error("fixture has no camera");
    calls.release = () => undefined;
    change.change(permission);
    change.confirm();
    expect(change.changing.value).toBe("android.permission.CAMERA");
    expect(change.optimistic.value).toEqual({ name: "android.permission.CAMERA", granted: false });

    const again = { ...permission, granted: false };
    change.change(again);
    await Promise.resolve();
    expect(calls.shell).toHaveLength(1);
    expect(calls.toasts).toEqual([
      { kind: "info", title: "Another permission is still being changed" },
    ]);

    calls.release?.();
    await vi.waitFor(() => expect(change.changing.value).toBeNull());
    expect(change.optimistic.value).toBeNull();
  });

  it("a refusal from pm is shown and the permissions are still read again", async () => {
    const { change, camera, rereads } = mount();
    calls.shellOutput = "java.lang.SecurityException: not a changeable permission type";
    const permission = camera();
    if (!permission) throw new Error("fixture has no camera");
    change.change(permission);
    change.confirm();
    await vi.waitFor(() => expect(change.changing.value).toBeNull());
    expect(calls.toasts[0]).toEqual({ kind: "error", title: "Could not change Camera" });
    expect(rereads()).toBe(1);
  });
});
