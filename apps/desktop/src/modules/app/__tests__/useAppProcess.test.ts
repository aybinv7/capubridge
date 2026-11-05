import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { effectScope, nextTick, ref, type Ref } from "vue";
import type { AppSubject } from "../subject/subject.types";
import { CPUINFO_LINE, MEMINFO_RUNNING, MEMINFO_STOPPED, PACKAGE } from "./fixtures";

type Responder = (serial: string, command: string) => Promise<string>;

const shell = vi.hoisted(() => ({
  calls: [] as Array<{ serial: string; command: string }>,
  respond: null as null | ((serial: string, command: string) => Promise<string>),
}));

vi.mock("@/composables/useAdb", () => ({
  useAdb: () => ({
    shellCommand: (serial: string, command: string) => {
      shell.calls.push({ serial, command });
      if (!shell.respond) throw new Error("no responder");
      return shell.respond(serial, command);
    },
  }),
}));

vi.mock("@vueuse/core", async (original) => {
  const actual = await original<typeof import("@vueuse/core")>();
  const { ref: makeRef } = await import("vue");
  const visibility = makeRef("visible");
  return { ...actual, useDocumentVisibility: () => visibility, __visibility: visibility };
});

const vueuse = (await import("@vueuse/core")) as unknown as { __visibility: Ref<string> };
const { createAppProcess } = await import("../process/useAppProcess");

const RUNNING = `${MEMINFO_RUNNING}__capubridge_cpu__\n${CPUINFO_LINE}`;
const STOPPED = `${MEMINFO_STOPPED}__capubridge_cpu__\n`;
const scopes: Array<ReturnType<typeof effectScope>> = [];

function answer(output: string): Responder {
  return () => Promise.resolve(output);
}

async function settle() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

function mount(initial: AppSubject | null = { serial: "phone-a", packageName: PACKAGE }) {
  const scope = effectScope();
  scopes.push(scope);
  const subject = ref<AppSubject | null>(initial);
  const wanted = ref(true);
  const process = scope.run(() => createAppProcess(subject, wanted));
  if (!process) throw new Error("scope did not run");
  return { process, subject, wanted };
}

beforeEach(() => {
  vi.useFakeTimers();
  shell.respond = answer(RUNNING);
});

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  shell.calls.length = 0;
  shell.respond = null;
  vueuse.__visibility.value = "visible";
  vi.useRealTimers();
});

describe("createAppProcess", () => {
  it("reads the app with one shell per reading, every 2.5 s", async () => {
    const { process } = mount();
    await settle();
    expect(shell.calls).toHaveLength(1);
    expect(shell.calls[0]?.command).toContain(`dumpsys meminfo ${PACKAGE}`);
    expect(process.latest.value?.pid).toBe(4321);
    expect(process.values("pss")).toEqual([50]);

    await vi.advanceTimersByTimeAsync(2500);
    await settle();
    expect(shell.calls).toHaveLength(2);
    expect(process.values("cpu")).toEqual([12, 12]);
  });

  it("switching apps forgets the old readings and drops the old app's late answer", async () => {
    let release: (value: string) => void = () => undefined;
    shell.respond = () => new Promise<string>((resolve) => (release = resolve));
    const { process, subject } = mount();
    await settle();

    shell.respond = answer(STOPPED);
    subject.value = { serial: "phone-b", packageName: "com.other.app" };
    await settle();
    release(RUNNING);
    await settle();

    expect(shell.calls.map((call) => call.serial)).toEqual(["phone-a", "phone-b"]);
    expect(process.latest.value?.running).toBe(false);
    expect(process.values("pss")).toEqual([null]);
  });

  it("an app that is not running leaves a gap and keeps being read", async () => {
    shell.respond = answer(STOPPED);
    const { process } = mount();
    await settle();
    expect(process.latest.value?.running).toBe(false);
    expect(process.values("pss")).toEqual([null]);

    shell.respond = answer(RUNNING);
    await vi.advanceTimersByTimeAsync(2500);
    await settle();
    expect(process.latest.value?.running).toBe(true);
    expect(process.values("pss")).toEqual([null, 50]);
  });

  it("leaving the App tabs or hiding the window stops reading and keeps the history", async () => {
    const { process, wanted } = mount();
    await settle();
    wanted.value = false;
    await settle();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(shell.calls).toHaveLength(1);
    expect(process.isRunning.value).toBe(false);
    expect(process.values("pss")).toEqual([50]);

    wanted.value = true;
    vueuse.__visibility.value = "hidden";
    await settle();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(shell.calls).toHaveLength(1);
  });

  it("a pause stops the readings and a resume reads right away", async () => {
    const { process } = mount();
    await settle();
    process.pause();
    await settle();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(shell.calls).toHaveLength(1);
    process.resume();
    await settle();
    expect(shell.calls).toHaveLength(2);
  });

  it("a failed read is reported and cleared by the next good one", async () => {
    shell.respond = () => Promise.reject(new Error("device offline"));
    const { process } = mount();
    await settle();
    expect(process.error.value).toContain("device offline");

    shell.respond = answer(RUNNING);
    await vi.advanceTimersByTimeAsync(2500);
    await settle();
    expect(process.error.value).toBeNull();
  });

  it("no app means no reading at all", async () => {
    mount(null);
    await settle();
    await vi.advanceTimersByTimeAsync(5000);
    expect(shell.calls).toHaveLength(0);
  });
});
