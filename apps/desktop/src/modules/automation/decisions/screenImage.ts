import type { DecisionImageSupport } from "./decisionModels";
import type { DecisionImage } from "./decisionTypes";

/** A screen image ready to send, plus the device size its box answers map back onto. */
export interface ScreenImage {
  image: DecisionImage;
  deviceWidth: number;
  deviceHeight: number;
}

/** Encodes a device PNG into an image the model accepts. Injected so tests need no canvas. */
export type ScreenEncoder = (
  pngBase64: string,
  support: DecisionImageSupport,
  slot: string,
) => Promise<ScreenImage>;

/**
 * The largest size inside the model's limits that keeps the aspect ratio,
 * never upscaled. Null when no such size exists, such as a very tall strip
 * whose short side would fall under the minimum once the long side fits.
 */
export function fitScreenSize(
  width: number,
  height: number,
  support: Pick<DecisionImageSupport, "minSide" | "maxSide" | "maxPixels">,
): { width: number; height: number } | null {
  if (width <= 0 || height <= 0) {
    return null;
  }
  let scale = 1;
  if (support.maxSide !== null) {
    scale = Math.min(scale, support.maxSide / Math.max(width, height));
  }
  if (support.maxPixels !== null) {
    scale = Math.min(scale, Math.sqrt(support.maxPixels / (width * height)));
  }
  const fitted = {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
  if (support.minSide !== null && Math.min(fitted.width, fitted.height) < support.minSide) {
    return null;
  }
  return fitted;
}

/** JPEG quality for screen images: small enough to send each step, sharp enough for UI text. */
const SCREEN_JPEG_QUALITY = 0.85;

/**
 * WebView encoder: decodes the device PNG, scales it into the model's limits
 * and re-encodes it as JPEG. Throws with a plain message when the screen
 * cannot fit the model's limits.
 */
export const encodeScreenInWebView: ScreenEncoder = async (pngBase64, support, slot) => {
  const bytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  try {
    const size = fitScreenSize(bitmap.width, bitmap.height, support);
    if (size === null) {
      throw new Error(
        `a ${bitmap.width}x${bitmap.height} screen cannot fit the model's image limits`,
      );
    }
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no 2d canvas context to scale the screen image");
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: SCREEN_JPEG_QUALITY });
    return {
      image: {
        slot,
        format: "jpeg",
        base64: await blobToBase64(blob),
        width: size.width,
        height: size.height,
      },
      deviceWidth: bitmap.width,
      deviceHeight: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
};

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}
