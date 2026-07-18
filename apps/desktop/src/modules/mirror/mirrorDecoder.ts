import { Channel } from "@tauri-apps/api/core";
import type { Ref } from "vue";
import type {
  RawScreencastFrameEvent,
  ScrcpyFrameEvent,
  ScreencastFrameMetadata,
} from "./mirrorTypes";

interface MirrorDecoderOptions {
  canvasElement: Ref<HTMLCanvasElement | null>;
  isSessionCurrent: (sessionId: number) => boolean;
  onScrcpyFailure: (serial: string, reason: string, sessionId: number) => Promise<void>;
  onChromeFailure: (reason: string, sessionId: number) => Promise<void>;
  onDeviceSize: (width: number, height: number) => void;
  onFrameRendered: () => void;
  getFallbackSize: () => ScreencastFrameMetadata;
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new Uint8Array(bytes.byteLength);
  buffer.set(bytes);
  return buffer.buffer;
}

export function parseScreencastMetadata(
  raw: RawScreencastFrameEvent["metadata"],
  fallback: ScreencastFrameMetadata,
): ScreencastFrameMetadata {
  const width = Number(raw?.deviceWidth);
  const height = Number(raw?.deviceHeight);
  return {
    deviceWidth: Number.isFinite(width) && width > 0 ? width : fallback.deviceWidth,
    deviceHeight: Number.isFinite(height) && height > 0 ? height : fallback.deviceHeight,
  };
}

export function createMirrorDecoder(options: MirrorDecoderOptions) {
  let decoder: VideoDecoder | null = null;
  let pendingVideoFrame: VideoFrame | null = null;
  let drawScheduled = false;
  let pendingChromeFrame: { data: string; metadata: ScreencastFrameMetadata } | null = null;
  let chromeDrawInFlight = false;
  let canUseImageBitmap = typeof createImageBitmap === "function";

  function cleanupScrcpy() {
    if (pendingVideoFrame) {
      pendingVideoFrame.close();
      pendingVideoFrame = null;
    }
    drawScheduled = false;
    if (decoder && decoder.state !== "closed") decoder.close();
    decoder = null;
  }

  function cleanupChrome() {
    pendingChromeFrame = null;
    chromeDrawInFlight = false;
  }

  function cleanup() {
    cleanupScrcpy();
    cleanupChrome();
  }

  async function waitForCanvas(timeoutMs: number) {
    const startedAt = performance.now();
    while (!options.canvasElement.value && performance.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    return options.canvasElement.value;
  }

  function drawVideoFrame(frame: VideoFrame) {
    const canvas = options.canvasElement.value;
    if (!canvas) {
      frame.close();
      return;
    }
    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      frame.close();
      return;
    }
    context.drawImage(frame, 0, 0);
    frame.close();
  }

  function queueVideoFrame(frame: VideoFrame) {
    pendingVideoFrame?.close();
    pendingVideoFrame = frame;
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      const next = pendingVideoFrame;
      pendingVideoFrame = null;
      if (next) drawVideoFrame(next);
    });
  }

  function createScrcpyChannel(
    serial: string,
    sessionId: number,
    onFirstFrame: () => void,
    onDisconnected: (reason: string) => void,
  ) {
    let firstFrameSeen = false;
    const channel = new Channel<ScrcpyFrameEvent>();
    channel.onmessage = (message) => {
      if (!options.isSessionCurrent(sessionId)) return;
      if (message.event === "config") {
        cleanupScrcpy();
        const nextDecoder = new VideoDecoder({
          output: (frame) => {
            if (!firstFrameSeen) {
              firstFrameSeen = true;
              onFirstFrame();
            }
            queueVideoFrame(frame);
          },
          error: (cause) => {
            void options.onScrcpyFailure(serial, `decoder error: ${String(cause)}`, sessionId);
          },
        });
        const config: VideoDecoderConfig = {
          codec: message.data.codec,
          description: bytesToArrayBuffer(base64ToBytes(message.data.description)),
          hardwareAcceleration: "prefer-hardware",
        };
        void VideoDecoder.isConfigSupported(config)
          .then((result) => {
            if (!options.isSessionCurrent(sessionId)) {
              nextDecoder.close();
              return;
            }
            if (!result.supported) {
              nextDecoder.close();
              void options.onScrcpyFailure(
                serial,
                `codec not supported: ${message.data.codec}`,
                sessionId,
              );
              return;
            }
            nextDecoder.configure(config);
            decoder = nextDecoder;
          })
          .catch((cause) => {
            nextDecoder.close();
            void options.onScrcpyFailure(
              serial,
              `config check failed: ${String(cause)}`,
              sessionId,
            );
          });
        return;
      }
      if (message.event === "packet") {
        if (!decoder || decoder.state !== "configured") return;
        try {
          decoder.decode(
            new EncodedVideoChunk({
              type: message.data.key ? "key" : "delta",
              timestamp: message.data.timestamp,
              data: base64ToBytes(message.data.data),
            }),
          );
        } catch (cause) {
          void options.onScrcpyFailure(serial, `packet decode failed: ${String(cause)}`, sessionId);
        }
        return;
      }
      cleanupScrcpy();
      onDisconnected(message.data.reason);
    };
    return { channel, hasFirstFrame: () => firstFrameSeen };
  }

  async function drawChromeFrame(
    data: string,
    metadata: ScreencastFrameMetadata,
    sessionId: number,
  ) {
    const canvas = options.canvasElement.value;
    if (!canvas || !options.isSessionCurrent(sessionId)) return;
    const frameWidth = Math.max(1, Math.round(metadata.deviceWidth));
    const frameHeight = Math.max(1, Math.round(metadata.deviceHeight));
    if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
      canvas.width = frameWidth;
      canvas.height = frameHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    const blob = new Blob([bytesToArrayBuffer(base64ToBytes(data))], { type: "image/jpeg" });
    if (canUseImageBitmap) {
      try {
        const bitmap = await createImageBitmap(blob);
        if (!options.isSessionCurrent(sessionId)) {
          bitmap.close();
          return;
        }
        context.drawImage(bitmap, 0, 0, frameWidth, frameHeight);
        bitmap.close();
        return;
      } catch (cause) {
        canUseImageBitmap = false;
        console.warn("ImageBitmap frame decoding failed; using image fallback", cause);
      }
    }
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Failed to decode screencast frame"));
        nextImage.src = url;
      });
      if (options.isSessionCurrent(sessionId)) {
        context.drawImage(image, 0, 0, frameWidth, frameHeight);
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function pumpChromeFrames(sessionId: number) {
    while (options.isSessionCurrent(sessionId) && pendingChromeFrame) {
      const frame = pendingChromeFrame;
      pendingChromeFrame = null;
      options.onDeviceSize(frame.metadata.deviceWidth, frame.metadata.deviceHeight);
      try {
        await drawChromeFrame(frame.data, frame.metadata, sessionId);
        options.onFrameRendered();
      } catch (cause) {
        await options.onChromeFailure(`frame render failed: ${String(cause)}`, sessionId);
        break;
      }
    }
    chromeDrawInFlight = false;
    if (options.isSessionCurrent(sessionId) && pendingChromeFrame) {
      chromeDrawInFlight = true;
      void pumpChromeFrames(sessionId);
    }
  }

  function queueChromeFrame(data: string, metadata: ScreencastFrameMetadata, sessionId: number) {
    pendingChromeFrame = { data, metadata };
    if (chromeDrawInFlight) return;
    chromeDrawInFlight = true;
    void pumpChromeFrames(sessionId);
  }

  function parseMetadata(raw: RawScreencastFrameEvent["metadata"]) {
    return parseScreencastMetadata(raw, options.getFallbackSize());
  }

  return {
    cleanup,
    cleanupScrcpy,
    cleanupChrome,
    waitForCanvas,
    createScrcpyChannel,
    queueChromeFrame,
    parseMetadata,
  };
}
