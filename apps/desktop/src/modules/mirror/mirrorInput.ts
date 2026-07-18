import { listenEvent } from "@/runtime/ipc";
import type { CDPClient } from "@capubridge/cdp-protocol";
import type { createAdbMirrorTransport } from "./mirrorTransport";
import {
  AndroidKey,
  type AndroidKeyCode,
  type MirrorKeyboardEvent,
  type MirrorSource,
  type TouchAction,
} from "./mirrorTypes";

interface TouchRequest {
  action: TouchAction;
  x: number;
  y: number;
}

interface MirrorInputOptions {
  adb: ReturnType<typeof createAdbMirrorTransport>;
  getSource: () => MirrorSource | null;
  isStreaming: () => boolean;
  resolveSerial: () => string | null;
  getChromeClient: () => Promise<CDPClient | null>;
  activateChromeTarget: () => Promise<void>;
  isChromePhoneMode: () => boolean;
  setError: (message: string) => void;
  onKeyError: (cause: unknown) => void;
}

const ANDROID_KEY_ACTION_DOWN = 0;
const ANDROID_KEY_ACTION_UP = 1;
const ANDROID_META_SHIFT_ON = 1;
const ANDROID_META_ALT_ON = 2;
const ANDROID_META_CTRL_ON = 4096;
const ANDROID_META_META_ON = 65536;
const SCRCPY_COPY_KEY_COPY = 1;
const SCRCPY_COPY_KEY_CUT = 2;

export function getAndroidMetaState(event: MirrorKeyboardEvent) {
  let metaState = 0;
  if (event.shiftKey) metaState |= ANDROID_META_SHIFT_ON;
  if (event.altKey) metaState |= ANDROID_META_ALT_ON;
  if (event.ctrlKey) metaState |= ANDROID_META_CTRL_ON;
  if (event.metaKey) metaState |= ANDROID_META_META_ON;
  return metaState;
}

export function resolveSpecialAndroidKey(event: MirrorKeyboardEvent): AndroidKeyCode | null {
  const keyMap: Record<string, AndroidKeyCode> = {
    Enter: AndroidKey.ENTER,
    Backspace: AndroidKey.DEL,
    Delete: AndroidKey.FORWARD_DEL,
    Tab: AndroidKey.TAB,
    Escape: AndroidKey.BACK,
    ArrowUp: AndroidKey.DPAD_UP,
    ArrowDown: AndroidKey.DPAD_DOWN,
    ArrowLeft: AndroidKey.DPAD_LEFT,
    ArrowRight: AndroidKey.DPAD_RIGHT,
    PageUp: AndroidKey.PAGE_UP,
    PageDown: AndroidKey.PAGE_DOWN,
    Home: AndroidKey.MOVE_HOME,
    End: AndroidKey.MOVE_END,
  };
  return keyMap[event.key] ?? null;
}

export function clampScrollDelta(delta: number) {
  return Math.max(-1, Math.min(1, delta / 120));
}

export function getWindowsVirtualKeyCode(event: MirrorKeyboardEvent) {
  const keyMap: Record<string, number> = {
    Enter: 13,
    Backspace: 8,
    Delete: 46,
    Tab: 9,
    Escape: 27,
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39,
    PageUp: 33,
    PageDown: 34,
    Home: 36,
    End: 35,
  };
  if (event.key.length === 1) return event.key.toUpperCase().charCodeAt(0);
  return keyMap[event.key] ?? 0;
}

export function getChromeModifiers(event: MirrorKeyboardEvent) {
  let modifiers = 0;
  if (event.altKey) modifiers |= 1;
  if (event.ctrlKey) modifiers |= 2;
  if (event.metaKey) modifiers |= 4;
  if (event.shiftKey) modifiers |= 8;
  return modifiers;
}

export function createMirrorInput(options: MirrorInputOptions) {
  let touchQueue: TouchRequest[] = [];
  let touchProcessing = false;
  let pointerDown = false;
  let clipboardUnlisten: (() => void) | null = null;
  let lastDeviceClipboardText = "";
  let didWarnClipboardWriteFallback = false;
  let didWarnClipboardReadFallback = false;
  let didWarnChromeTouchFallback = false;

  function reset() {
    touchQueue = [];
    touchProcessing = false;
    pointerDown = false;
  }

  async function writeHostClipboardText(text: string) {
    try {
      const clipboard = await import("@tauri-apps/plugin-clipboard-manager");
      await clipboard.writeText(text);
      return;
    } catch (cause) {
      if (!didWarnClipboardWriteFallback) {
        didWarnClipboardWriteFallback = true;
        console.warn("Native clipboard write unavailable; using browser clipboard", cause);
      }
    }
    await navigator.clipboard.writeText(text);
  }

  async function readHostClipboardText() {
    try {
      const clipboard = await import("@tauri-apps/plugin-clipboard-manager");
      return await clipboard.readText();
    } catch (cause) {
      if (!didWarnClipboardReadFallback) {
        didWarnClipboardReadFallback = true;
        console.warn("Native clipboard read unavailable; using browser clipboard", cause);
      }
    }
    return navigator.clipboard.readText();
  }

  async function setupClipboardListener() {
    if (clipboardUnlisten) return;
    try {
      clipboardUnlisten = await listenEvent(
        "capubridge:mirror-device-clipboard",
        async (payload) => {
          const serial = options.resolveSerial();
          if (!serial || payload.serial !== serial) return;
          if (!payload.text || payload.text === lastDeviceClipboardText) return;
          lastDeviceClipboardText = payload.text;
          await writeHostClipboardText(payload.text).catch((cause) => {
            console.warn("Failed to synchronize device clipboard", cause);
          });
        },
      );
    } catch (cause) {
      options.setError(`Failed to subscribe to device clipboard: ${String(cause)}`);
    }
  }

  function cleanupClipboardListener() {
    clipboardUnlisten?.();
    clipboardUnlisten = null;
  }

  async function sendAndroidKeycode(keycode: AndroidKeyCode, metaState = 0) {
    if (options.getSource() !== "adb") return;
    const serial = options.resolveSerial();
    if (!serial) return;
    await options.adb.injectKeycode(serial, ANDROID_KEY_ACTION_DOWN, keycode, metaState);
    await options.adb.injectKeycode(serial, ANDROID_KEY_ACTION_UP, keycode, metaState);
  }

  async function sendKey(keycode: AndroidKeyCode) {
    if (options.getSource() !== "adb") return;
    const serial = options.resolveSerial();
    if (!serial) return;
    try {
      await options.adb.keyEvent(serial, keycode);
    } catch (cause) {
      options.onKeyError(cause);
    }
  }

  async function dispatchTouch(action: TouchAction, x: number, y: number) {
    if (options.getSource() === "adb") {
      const serial = options.resolveSerial();
      if (serial) await options.adb.touch(serial, action, x, y);
      return;
    }
    if (options.getSource() !== "chrome") return;
    if (action === "down") await options.activateChromeTarget();
    const activeClient = await options.getChromeClient();
    if (!activeClient) return;
    const dispatchMouse = async () => {
      const eventType =
        action === "down" ? "mousePressed" : action === "up" ? "mouseReleased" : "mouseMoved";
      if (action === "down") pointerDown = true;
      if (action === "up") pointerDown = false;
      await activeClient.send("Input.dispatchMouseEvent", {
        type: eventType,
        x,
        y,
        button: "left",
        buttons: pointerDown || action === "down" ? 1 : 0,
        clickCount: action === "move" ? 0 : 1,
      });
    };
    if (options.isChromePhoneMode()) {
      const touchType =
        action === "down" ? "touchStart" : action === "up" ? "touchEnd" : "touchMove";
      if (action === "down") pointerDown = true;
      if (action === "up") pointerDown = false;
      try {
        await activeClient.send("Input.dispatchTouchEvent", {
          type: touchType,
          touchPoints: action === "up" ? [] : [{ id: 1, x, y, radiusX: 1, radiusY: 1, force: 1 }],
          modifiers: 0,
        });
        return;
      } catch (cause) {
        if (!didWarnChromeTouchFallback) {
          didWarnChromeTouchFallback = true;
          console.warn("Chrome touch dispatch failed; using mouse fallback", cause);
        }
      }
    }
    await dispatchMouse();
  }

  async function processTouchQueue() {
    if (touchProcessing) return;
    if (!options.isStreaming()) {
      touchQueue = [];
      return;
    }
    touchProcessing = true;
    while (touchQueue.length > 0) {
      const item = touchQueue.shift();
      if (!item) continue;
      try {
        await dispatchTouch(item.action, item.x, item.y);
      } catch (cause) {
        if (item.action !== "move") options.setError(String(cause));
      }
    }
    touchProcessing = false;
  }

  function sendTouch(action: TouchAction, x: number, y: number) {
    if (!options.isStreaming()) return;
    if (action === "move" && touchQueue.at(-1)?.action === "move") {
      touchQueue[touchQueue.length - 1] = { action, x, y };
      return;
    }
    touchQueue.push({ action, x, y });
    void processTouchQueue();
  }

  async function sendWheel(x: number, y: number, deltaX: number, deltaY: number) {
    if (!options.isStreaming()) return;
    if (options.getSource() === "adb") {
      const serial = options.resolveSerial();
      if (!serial) return;
      try {
        await options.adb.scroll(
          serial,
          x,
          y,
          -clampScrollDelta(deltaX),
          -clampScrollDelta(deltaY),
        );
      } catch (cause) {
        options.setError(String(cause));
      }
      return;
    }
    if (options.getSource() !== "chrome") return;
    const activeClient = await options.getChromeClient();
    if (!activeClient) return;
    await activeClient.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX,
      deltaY,
    });
  }

  async function pasteHostClipboardToDevice() {
    if (options.getSource() !== "adb") return;
    const serial = options.resolveSerial();
    if (!serial) return;
    const text = await readHostClipboardText().catch((cause) => {
      options.setError(`Failed to read host clipboard: ${String(cause)}`);
      return "";
    });
    if (text) await options.adb.setClipboard(serial, text);
  }

  async function requestDeviceClipboard(copyKey: number) {
    if (options.getSource() !== "adb") return;
    const serial = options.resolveSerial();
    if (serial) await options.adb.getClipboard(serial, copyKey);
  }

  async function sendKeyboard(event: MirrorKeyboardEvent) {
    if (!options.isStreaming()) return;
    try {
      if (options.getSource() === "chrome") {
        const activeClient = await options.getChromeClient();
        if (!activeClient) return;
        const windowsVirtualKeyCode = getWindowsVirtualKeyCode(event);
        const modifiers = getChromeModifiers(event);
        await activeClient.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: event.key,
          code: event.code,
          windowsVirtualKeyCode,
          modifiers,
        });
        await activeClient.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: event.key,
          code: event.code,
          windowsVirtualKeyCode,
          modifiers,
        });
        return;
      }
      if (options.getSource() !== "adb") return;
      const shortcutKey = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "v") {
        await pasteHostClipboardToDevice();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "c") {
        await requestDeviceClipboard(SCRCPY_COPY_KEY_COPY);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "x") {
        await requestDeviceClipboard(SCRCPY_COPY_KEY_CUT);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "a") {
        await sendAndroidKeycode(AndroidKey.A, ANDROID_META_CTRL_ON);
        return;
      }
      const serial = options.resolveSerial();
      if (!serial) return;
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        await options.adb.injectText(serial, event.key);
        return;
      }
      const keycode = resolveSpecialAndroidKey(event);
      if (keycode) await sendAndroidKeycode(keycode, getAndroidMetaState(event));
    } catch (cause) {
      options.setError(String(cause));
    }
  }

  return {
    reset,
    setupClipboardListener,
    cleanupClipboardListener,
    sendKey,
    sendTouch,
    sendWheel,
    sendKeyboard,
  };
}
