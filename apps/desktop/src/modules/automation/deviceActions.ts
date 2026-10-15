import { invokeCommand } from "@/runtime/ipc/client";
import type { ScreenPoint } from "@/types/automation.types";

/**
 * Typed device action surface for automation. The executor calls this, never
 * invoke directly. Every method is backed by an existing Rust command: the
 * mirror tap/swipe pair is not usable here because it requires an open
 * scrcpy control session, while automation runs must act with no mirror open.
 */
export interface DeviceActions {
  tap(serial: string, x: number, y: number): Promise<void>;
  longPress(serial: string, x: number, y: number, durationMs: number): Promise<void>;
  swipe(serial: string, from: ScreenPoint, to: ScreenPoint, durationMs: number): Promise<void>;
  scroll(
    serial: string,
    origin: ScreenPoint,
    direction: "up" | "down" | "left" | "right",
    distance: number,
  ): Promise<void>;
  inputText(serial: string, text: string): Promise<void>;
  pressKey(serial: string, keycode: string): Promise<void>;
  back(serial: string): Promise<void>;
  openApp(serial: string, packageName: string): Promise<void>;
  screenSize(serial: string): Promise<{ width: number; height: number }>;
}

/** One recorded fake call: the method name plus the arguments it received. */
export interface RecordedDeviceCall {
  method: string;
  args: unknown[];
}

/** Configuration for the fake: screen size to report and per-method failures. */
export interface FakeDeviceActionsConfig {
  screenSize?: { width: number; height: number };
  failures?: Partial<Record<string, string>>;
}

/** Fake actions plus the recorded call log. */
export interface FakeDeviceActions extends DeviceActions {
  calls: RecordedDeviceCall[];
}

/**
 * Real implementation built on the existing adb_shell_command and
 * adb_open_package commands. Every failure surfaces a message naming the
 * action and the serial.
 */
export function createDeviceActions(): DeviceActions {
  return {
    tap: (serial, x, y) =>
      runShell(
        serial,
        "tap",
        `input tap ${toDeviceInt(x, "tap", serial)} ${toDeviceInt(y, "tap", serial)}`,
      ),
    longPress: (serial, x, y, durationMs) =>
      runShell(
        serial,
        "longPress",
        `input swipe ${toDeviceInt(x, "longPress", serial)} ${toDeviceInt(y, "longPress", serial)} ${toDeviceInt(x, "longPress", serial)} ${toDeviceInt(y, "longPress", serial)} ${toDuration(durationMs)}`,
      ),
    swipe: (serial, from, to, durationMs) =>
      runShell(
        serial,
        "swipe",
        `input swipe ${toDeviceInt(from.x, "swipe", serial)} ${toDeviceInt(from.y, "swipe", serial)} ${toDeviceInt(to.x, "swipe", serial)} ${toDeviceInt(to.y, "swipe", serial)} ${toDuration(durationMs)}`,
      ),
    scroll: (serial, origin, direction, distance) => {
      const delta = Math.max(1, toDuration(distance));
      const to =
        direction === "up"
          ? { x: origin.x, y: Math.max(0, origin.y - delta) }
          : direction === "down"
            ? { x: origin.x, y: origin.y + delta }
            : direction === "left"
              ? { x: Math.max(0, origin.x - delta), y: origin.y }
              : { x: origin.x + delta, y: origin.y };
      return runShell(
        serial,
        "scroll",
        `input swipe ${toDeviceInt(origin.x, "scroll", serial)} ${toDeviceInt(origin.y, "scroll", serial)} ${toDeviceInt(to.x, "scroll", serial)} ${toDeviceInt(to.y, "scroll", serial)} 300`,
      );
    },
    inputText: (serial, text) =>
      runShell(serial, "inputText", `input text ${encodeInputText(text)}`),
    pressKey: (serial, keycode) =>
      runShell(
        serial,
        "pressKey",
        `input keyevent ${shellQuote(requireNonEmpty(keycode, "pressKey", serial))}`,
      ),
    back: (serial) => runShell(serial, "back", "input keyevent KEYCODE_BACK"),
    openApp: async (serial, packageName) => {
      requireNonEmpty(packageName, "openApp", serial);
      try {
        await invokeCommand("adb_open_package", { serial, packageName });
      } catch (error) {
        throw new Error(`automation openApp failed on device ${serial}: ${messageOf(error)}`);
      }
    },
    screenSize: async (serial) => {
      let output: string;
      try {
        output = await invokeCommand("adb_shell_command", { serial, command: "wm size" });
      } catch (error) {
        throw new Error(`automation screenSize failed on device ${serial}: ${messageOf(error)}`);
      }
      const size = parseWmSize(output);
      if (size === null) {
        throw new Error(
          `automation screenSize failed on device ${serial}: unparsable wm size output ${JSON.stringify(output)}`,
        );
      }
      return size;
    },
  };
}

/**
 * Fake implementation for other tasks' tests. Records calls in order and
 * honours configured results and failures.
 */
export function createFakeDeviceActions(config: FakeDeviceActionsConfig = {}): FakeDeviceActions {
  const calls: RecordedDeviceCall[] = [];
  const fail = (method: string, args: unknown[]): void => {
    const message = config.failures?.[method];
    if (message !== undefined) {
      throw new Error(message);
    }
    calls.push({ method, args });
  };
  return {
    calls,
    tap: async (serial, x, y) => {
      fail("tap", [serial, x, y]);
    },
    longPress: async (serial, x, y, durationMs) => {
      fail("longPress", [serial, x, y, durationMs]);
    },
    swipe: async (serial, from, to, durationMs) => {
      fail("swipe", [serial, from, to, durationMs]);
    },
    scroll: async (serial, origin, direction, distance) => {
      fail("scroll", [serial, origin, direction, distance]);
    },
    inputText: async (serial, text) => {
      fail("inputText", [serial, text]);
    },
    pressKey: async (serial, keycode) => {
      fail("pressKey", [serial, keycode]);
    },
    back: async (serial) => {
      fail("back", [serial]);
    },
    openApp: async (serial, packageName) => {
      fail("openApp", [serial, packageName]);
    },
    screenSize: async (serial) => {
      fail("screenSize", [serial]);
      return config.screenSize ?? { width: 1080, height: 2400 };
    },
  };
}

/**
 * Runs one device shell command, treating error-marked output as failure.
 * ADB reports some failures with exit code 0, so both transport errors and
 * suspicious output surface as failures naming the action and the serial.
 */
async function runShell(serial: string, action: string, command: string): Promise<void> {
  let output: string;
  try {
    output = await invokeCommand("adb_shell_command", { serial, command });
  } catch (error) {
    throw new Error(`automation ${action} failed on device ${serial}: ${messageOf(error)}`);
  }
  if (/^\s*(error|exception|usage\b|.*\bnot found)/im.test(output)) {
    throw new Error(
      `automation ${action} failed on device ${serial}: device reported ${JSON.stringify(output.trim())}`,
    );
  }
}

/**
 * Encodes text for the device `input text` command. Spaces become `%s` and
 * the whole argument is single-quoted for the device shell. Two documented
 * limitations: a literal `%s` in the text arrives as a space, and non-ASCII
 * characters are mangled by the device `input` command itself, so non-ASCII
 * entry should go through CDP text insertion instead.
 */
export function encodeInputText(text: string): string {
  return shellQuote(text.replace(/ /g, "%s"));
}

/**
 * Single-quotes one shell argument for the device shell.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Parses `wm size` output, preferring the override size when present.
 */
function parseWmSize(output: string): { width: number; height: number } | null {
  const lines = output.split("\n");
  const pick = (needle: string): { width: number; height: number } | null => {
    const line = lines.find((entry) => entry.toLowerCase().includes(needle));
    if (line === undefined) {
      return null;
    }
    const match = /(\d+)\s*x\s*(\d+)/.exec(line);
    if (match === null) {
      return null;
    }
    return { width: Number(match[1]), height: Number(match[2]) };
  };
  return pick("override") ?? pick("physical");
}

/**
 * Validates a coordinate and rounds it to a device pixel.
 */
function toDeviceInt(value: number, action: string, serial: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `automation ${action} failed on device ${serial}: invalid coordinate ${String(value)}`,
    );
  }
  return Math.round(value);
}

/**
 * Normalizes a duration to whole milliseconds.
 */
function toDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 0;
  }
  return Math.round(durationMs);
}

/**
 * Rejects an empty string parameter with an action- and serial-named error.
 */
function requireNonEmpty(value: string, action: string, serial: string): string {
  if (value.length === 0) {
    throw new Error(`automation ${action} failed on device ${serial}: parameter must not be empty`);
  }
  return value;
}

/**
 * Renders an unknown failure for an error message without throwing.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}
