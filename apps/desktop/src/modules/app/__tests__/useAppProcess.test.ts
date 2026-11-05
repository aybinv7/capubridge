import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { effectScope, nextTick, ref, type Ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { AppSubject } from "../subject/subject.types";
import { APP, NOT_RUNNING_OUTPUT, processReadOutput } from "./android16.fixtures";

type Responder = (serial: string, command: string) => Promise<string>;

const shell = vi.hoisted(() => ({
  calls: [] as Array<{ serial: string; command: string }>,
  respond: null as null | ((serial: string, command: string) => Promise<string>),
}));

vi.mock("@/composables/useAdb", () => ({
  useAdb: () => ({
    readShell: (serial: string, command: string) => {
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

const scopes: Array<ReturnType<typeof effectScope>> = [];
let uptime = 1000;
let ticks = 55_230;

/** Answers like the phone: the clock moves 2.5 s and the app used 200 ticks per reading. */
function running(): Responder {
  return (_serial, command) => {
    uptime += 2.5;
    ticks += 200;
    return Promise.resolve(
      processReadOutput({
        uptime,
        userTicks: ticks,
        memory: command.includes("dumpsys meminfo"),
        cores: command.includes("nproc"),
      }),
    );
  };
}

function answer(output: string): Responder {
  return () => Promise.resolve(output);
}

async function settle() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

function mount(initial: AppSubject | null = { serial: "phone-a", packageName: APP }) {
  const scope = effectScope();
  scopes.push(scope);
  const subject = ref<AppSubject | null>(initial);
  const wanted = ref(true);
  const user = ref<number | null>(0);
  const process = scope.run(() => createAppProcess(subject, wanted, user));
  if (!process) throw new Error("scope did not run");
  return { process, subject, wanted };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
  uptime = 1000;
  ticks = 55_230;
  shell.respond = running();
});

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  shell.calls.length = 0;
  shell.respond = null;
  vueuse.__visibility.value = "visible";
  vi.useRealTimers();
});

describe("createAppProcess", () => {
  it("reads /proc every 2.5 s and the heavy memory report only every fourth time", async () => {
    const { process } = mount();
    await settle();
    expect(shell.calls).toHaveLength(1);
    expect(shell.calls[0]?.command).toContain("dumpsys meminfo --local");
    expect(process.latest.value?.pid).toBe(23882);
    expect(process.latest.value?.threads).toBe(106);
    expect(process.latest.value?.cpu).toBeNull();
    expect(process.cores.value).toBe(8);

    for (let index = 0; index < 4; index += 1) {
      await vi.advanceTimersByTimeAsync(2500);
      await settle();
    }
    expect(shell.calls).toHaveLength(5);
    const memoryReads = shell.calls.filter((call) => call.command.includes("dumpsys meminfo"));
    expect(memoryReads).toHaveLength(2);
    expect(shell.calls[1]?.command).not.toContain("nproc");
    expect(process.latest.value?.cpu?.totalPct).toBeCloseTo(10);
    expect(process.latest.value?.memory?.totalPssKb).toBe(109_599);
    expect(process.values("pss")).toHaveLength(2);
    expect(process.values("cpu")).toHaveLength(5);
  });

  it("switching apps keeps each app's history apart and drops the old app's late answer", async () => {
    let release: (value: string) => void = () => undefined;
    shell.respond = () => new Promise<string>((resolve) => (release = resolve));
    const { process, subject } = mount();
    await settle();

    shell.respond = answer(NOT_RUNNING_OUTPUT);
    subject.value = { serial: "phone-b", packageName: "com.other.app" };
    await settle();
    release(processReadOutput({ memory: true }));
    await settle();

    expect(shell.calls.map((call) => call.serial)).toEqual(["phone-a", "phone-b"]);
    expect(process.latest.value?.running).toBe(false);
    expect(process.values("cpu")).toEqual([null]);
  });

  it("the history survives leaving the route: a new monitor for the same app keeps it", async () => {
    const first = mount();
    await settle();
    await vi.advanceTimersByTimeAsync(2500);
    await settle();
    expect(first.process.values("cpu")).toHaveLength(2);
    scopes.splice(0).forEach((scope) => scope.stop());

    shell.respond = () => new Promise<string>(() => undefined);
    const second = mount();
    await settle();
    expect(second.process.values("cpu")).toHaveLength(2);
    expect(second.process.latest.value?.pid).toBe(23882);
  });

  it("an app without a process leaves a gap and is read every 10 s", async () => {
    shell.respond = answer(NOT_RUNNING_OUTPUT);
    const { process } = mount();
    await settle();
    expect(process.latest.value?.running).toBe(false);
    expect(shell.calls[0]?.command).toContain("dumpsys meminfo");

    await vi.advanceTimersByTimeAsync(2500);
    await settle();
    expect(shell.calls).toHaveLength(1);
    shell.respond = running();
    await vi.advanceTimersByTimeAsync(7500);
    await settle();
    expect(shell.calls).toHaveLength(2);
    expect(shell.calls[1]?.command).not.toContain("dumpsys meminfo");
    expect(process.latest.value?.running).toBe(true);
    expect(process.values("cpu")).toEqual([null, null]);
  });

  it("leaving the App tabs or hiding the window stops reading and keeps the history", async () => {
    const { process, wanted } = mount();
    await settle();
    wanted.value = false;
    await settle();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(shell.calls).toHaveLength(1);
    expect(process.isRunning.value).toBe(false);
    expect(process.values("cpu")).toHaveLength(1);

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

  it("read now reads once more without restarting the loop", async () => {
    const { process } = mount();
    await settle();
    const started = process.startedAt.value;
    process.readNow();
    await settle();
    expect(shell.calls).toHaveLength(2);
    expect(process.startedAt.value).toBe(started);
    await vi.advanceTimersByTimeAsync(2500);
    await settle();
    expect(shell.calls).toHaveLength(3);
  });

  it("read now during a reading waits for it instead of reading twice at once", async () => {
    let release: (value: string) => void = () => undefined;
    shell.respond = () => new Promise<string>((resolve) => (release = resolve));
    const { process } = mount();
    await settle();
    process.readNow();
    await settle();
    expect(shell.calls).toHaveLength(1);
    shell.respond = running();
    release(processReadOutput({ memory: true, cores: true }));
    await settle();
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    expect(shell.calls).toHaveLength(2);
  });

  it("failures are reported and back off, and the next good reading clears them", async () => {
    shell.respond = () => Promise.reject(new Error("device offline"));
    const { process } = mount();
    await settle();
    expect(process.error.value).toContain("device offline");
    await vi.advanceTimersByTimeAsync(4999);
    expect(shell.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(shell.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(9999);
    expect(shell.calls).toHaveLength(2);

    shell.respond = running();
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(process.error.value).toBeNull();
  });

  it("a phone that never answers is given up on after six seconds", async () => {
    shell.respond = () => new Promise<string>(() => undefined);
    const { process } = mount();
    await settle();
    await vi.advanceTimersByTimeAsync(6000);
    await settle();
    expect(process.error.value).toContain("did not answer");
  });

  it("no app means no reading at all", async () => {
    mount(null);
    await settle();
    await vi.advanceTimersByTimeAsync(5000);
    expect(shell.calls).toHaveLength(0);
  });
});
