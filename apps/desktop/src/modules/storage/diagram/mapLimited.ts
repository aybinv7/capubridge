/**
 * Maps every item with at most `limit` calls in flight, keeping the input order. Rejects with
 * the first failure, after the calls already started have settled.
 */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  map: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  let failure: { error: unknown } | null = null;
  async function worker() {
    while (failure === null && next < items.length) {
      const index = next;
      next += 1;
      const item = items[index] as T;
      try {
        results[index] = await map(item, index);
      } catch (error) {
        failure ??= { error };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()),
  );
  if (failure !== null) throw (failure as { error: unknown }).error;
  return results;
}
