/** Error raised when {@link withTimeout} gives up waiting. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Rejects with a {@link TimeoutError} when `promise` has not settled after `ms`. The underlying
 * work is not cancelled; the caller only stops waiting for it.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });
}
