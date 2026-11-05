/** Resolves with the promise's answer, or rejects once `timeoutMs` passes without one. */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  what = "No answer",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} in ${timeoutMs / 1000} s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
