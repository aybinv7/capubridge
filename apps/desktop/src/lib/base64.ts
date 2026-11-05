const CHUNK = 0x8000;

/** Base64 of raw bytes, built in chunks so large bodies never spread a huge argument list. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

/** Base64 of a string's UTF-8 bytes. */
export function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

/** The bytes a Base64 string holds; throws when it is not Base64. */
export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** The UTF-8 text a Base64 string holds; throws when it is not Base64. */
export function base64ToUtf8(value: string): string {
  return new TextDecoder().decode(base64ToBytes(value));
}

/** How many bytes a Base64 string decodes to, without decoding it. */
export function base64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}
