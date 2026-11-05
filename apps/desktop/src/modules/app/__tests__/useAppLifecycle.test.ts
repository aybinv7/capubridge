import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { computed, effectScope, ref } from "vue";
import type { AppPresence } from "@/lib/gates/presence";
import type { AppProcess } from "../process/useAppProcess";
import type { AppSubject } from "../subject/subject.types";
import type { InspectedApp } from "../subject/useInspectedApp";
import { PACKAGE } from "./fixtures";

const calls = vi.hoisted(() => ({
  log: [] as string[],
  shellOutput: "",
  toasts: [] as Array<{ kind: "success" | "error"; title: string }>,
  invalidated: [] as unknown[][],
}));

vi.mock("@/composables/useAdb", () => ({
  useAdb: () => ({
    openPackage: async (serial: string, packageName: string) => {
      calls.log.push(`open ${serial} ${packageName}`);
      return "";
    },
    shellCommand: async (serial: string, command: string) => {
      calls.log.push(`shell ${serial} ${command}`);
      return calls.shellOutput;
    },
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: (title: string) => calls.toasts.push({ kind: "success", title }),
    error: (title: string) => calls.toasts.push({ kind: "error", title }),
  },
}));

vi.mock("@tanstack/vue-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: async ({ queryKey }: { queryKey: unknown[] }) => {
      calls.invalidated.push(queryKey);
    },
  }),
}));

const { useAppLifecycle } = await import("../lifecycle/useAppLifecycle");

const scopes: Array<ReturnType<typeof effectScope>> = [];

function mount(subjectValue: AppSubject | null, presenceValue: AppPresence = "foreground") {
  const subject = ref<AppSubject | null>(subjectValue);
  const presence = ref<AppPresence>(presenceValue);
  const probePresence = vi.fn();
  const readNow = vi.fn();
  const app = {
    subject,
    name: computed(() => "Presalio Retail"),
    entry: computed(() => null),
    presence: computed(() => presence.value),
    probePresence,
  } as unknown as InspectedApp;
  const process = { readNow } as unknown as AppProcess;
  const scope = effectScope();
  scopes.push(scope);
  const lifecycle = scope.run(() => useAppLifecycle(app, process));
  if (!lifecycle) throw new Error("scope did not run");
  return { lifecycle, probePresence, readNow, presence };
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  calls.log.length = 0;
  calls.toasts.length = 0;
  calls.invalidated.length = 0;
  calls.shellOutput = "";
});

const SUBJECT = { serial: "phone-a", packageName: PACKAGE };

describe("useAppLifecycle", () => {
  it("restart stops the app, opens it again and reads the process", async () => {
    const { lifecycle, readNow } = mount(SUBJECT);
    await lifecycle.restart();
    expect(calls.log).toEqual([
      `shell phone-a am force-stop ${PACKAGE}`,
      `open phone-a ${PACKAGE}`,
    ]);
    expect(calls.toasts).toEqual([{ kind: "success", title: "Presalio Retail restarted" }]);
    expect(readNow).toHaveBeenCalled();
  });

  it("an app in the background is brought to the front without a toast", async () => {
    const { lifecycle, probePresence } = mount(SUBJECT, "background");
    expect(lifecycle.inBackground.value).toBe(true);
    await lifecycle.open();
    expect(calls.log).toEqual([`open phone-a ${PACKAGE}`]);
    expect(calls.toasts).toEqual([]);
    expect(probePresence).toHaveBeenCalled();
  });

  it("an app on screen or not running is opened and said so", async () => {
    const { lifecycle } = mount(SUBJECT);
    await lifecycle.open();
    expect(calls.toasts).toEqual([
      { kind: "success", title: "Presalio Retail opened on the phone" },
    ]);
  });

  it("clear data asks first, by the app's name, then forgets what it changed", async () => {
    const { lifecycle } = mount(SUBJECT);
    lifecycle.request("clearData");
    expect(lifecycle.confirmOpen.value).toBe(true);
    expect(lifecycle.confirmRequest.value).toMatchObject({
      title: "Clear the data of Presalio Retail?",
      danger: true,
    });
    calls.shellOutput = "Success\n";
    await lifecycle.confirm();
    expect(calls.log).toEqual([`shell phone-a pm clear ${PACKAGE}`]);
    expect(lifecycle.confirmOpen.value).toBe(false);
    expect(calls.toasts).toEqual([{ kind: "success", title: "Data of Presalio Retail cleared" }]);
    expect(calls.invalidated.map((key) => key[0])).toEqual([
      "package-details",
      "app-package-dump",
      "app-usage-network",
      "app-usage-battery",
    ]);
  });

  it("a refused clear says what the phone answered and changes nothing", async () => {
    const { lifecycle } = mount(SUBJECT);
    lifecycle.request("clearData");
    calls.shellOutput = "Failed\n";
    await lifecycle.confirm();
    expect(calls.toasts).toEqual([{ kind: "error", title: "Could not clear the data" }]);
    expect(calls.invalidated).toEqual([]);
  });

  it("force stop asks first and is not dangerous", async () => {
    const { lifecycle } = mount(SUBJECT);
    lifecycle.request("forceStop");
    expect(lifecycle.confirmRequest.value?.danger).toBe(false);
    await lifecycle.confirm();
    expect(calls.log).toEqual([`shell phone-a am force-stop ${PACKAGE}`]);
  });

  it("does nothing without an app", async () => {
    const { lifecycle } = mount(null);
    lifecycle.request("forceStop");
    expect(lifecycle.confirmOpen.value).toBe(false);
    await lifecycle.open();
    await lifecycle.restart();
    expect(calls.log).toEqual([]);
  });
});
