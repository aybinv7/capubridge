export const AndroidKey = {
  HOME: 3,
  BACK: 4,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  A: 29,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  POWER: 26,
  TAB: 61,
  ENTER: 66,
  DEL: 67,
  FORWARD_DEL: 112,
  PAGE_UP: 92,
  PAGE_DOWN: 93,
  MOVE_HOME: 122,
  MOVE_END: 123,
  WAKEUP: 224,
  SLEEP: 223,
  RECENTS: 187,
} as const;

export type AndroidKeyCode = (typeof AndroidKey)[keyof typeof AndroidKey];
export type MirrorSource = "adb" | "chrome";
export type TouchAction = "down" | "move" | "up";

export interface MirrorKeyboardEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface ScrcpyStreamSettings {
  maxSize: number;
  maxFps: number;
  videoBitRate: number;
  videoCodec: "h264" | "h265";
}

export interface ScrcpyConfigEvent {
  event: "config";
  data: { codec: string; description: string };
}

export interface ScrcpyPacketEvent {
  event: "packet";
  data: { key: boolean; data: string; timestamp: number };
}

export interface ScrcpyDisconnectedEvent {
  event: "disconnected";
  data: { reason: string };
}

export type ScrcpyFrameEvent = ScrcpyConfigEvent | ScrcpyPacketEvent | ScrcpyDisconnectedEvent;

export interface ScreencastFrameMetadata {
  deviceWidth: number;
  deviceHeight: number;
}

export interface RawScreencastFrameEvent {
  data?: unknown;
  metadata?: {
    deviceWidth?: unknown;
    deviceHeight?: unknown;
  };
  sessionId?: unknown;
}
