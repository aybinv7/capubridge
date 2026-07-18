import type { Channel } from "@tauri-apps/api/core";
import type { IpcCommand } from "@/runtime/ipc/contracts/common";

export interface ScrcpyStreamSettings {
  maxSize: number;
  maxFps: number;
  videoBitRate: number;
  videoCodec: string;
}

export type ScrcpyFrameEvent =
  | { event: "config"; data: { codec: string; description: string } }
  | { event: "packet"; data: { key: boolean; data: string; timestamp: number } }
  | { event: "disconnected"; data: { reason: string } };

export interface ScreenSize {
  width: number;
  height: number;
}

export interface MirrorCommandMap {
  adb_mirror_scrcpy_start: IpcCommand<
    {
      serial: string;
      settings?: ScrcpyStreamSettings;
      onFrame: Channel<ScrcpyFrameEvent>;
    },
    [number, number]
  >;
  adb_mirror_scrcpy_stop: IpcCommand<{ serial: string }, void>;
  adb_mirror_launch_scrcpy: IpcCommand<
    { serial: string; maxSize?: number; bitRateMbps?: number; maxFps?: number },
    void
  >;
  adb_mirror_stop_scrcpy: IpcCommand<{ serial: string }, void>;
  adb_mirror_screenshot: IpcCommand<{ serial: string }, string>;
  adb_mirror_get_screen_size: IpcCommand<{ serial: string }, ScreenSize>;
  adb_mirror_keyevent: IpcCommand<{ serial: string; keycode: number }, void>;
  adb_mirror_inject_keycode: IpcCommand<
    { serial: string; action: number; keycode: number; repeat: number; metaState: number },
    void
  >;
  adb_mirror_inject_text: IpcCommand<{ serial: string; text: string }, void>;
  adb_mirror_scroll_event: IpcCommand<
    { serial: string; x: number; y: number; hScroll: number; vScroll: number },
    void
  >;
  adb_mirror_set_clipboard: IpcCommand<{ serial: string; text: string; paste: boolean }, void>;
  adb_mirror_get_clipboard: IpcCommand<{ serial: string; copyKey?: number }, void>;
  adb_mirror_touch_event: IpcCommand<
    { serial: string; action: string; x: number; y: number },
    void
  >;
  adb_mirror_tap: IpcCommand<{ serial: string; x: number; y: number }, void>;
  adb_mirror_swipe: IpcCommand<
    {
      serial: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs: number;
    },
    void
  >;
  adb_mirror_start_recording: IpcCommand<{ serial: string }, void>;
  adb_mirror_stop_recording: IpcCommand<{ serial: string; savePath: string }, void>;
  adb_perf_start: IpcCommand<{ serial: string }, void>;
  adb_perf_stop: IpcCommand<{ serial: string }, void>;
}
