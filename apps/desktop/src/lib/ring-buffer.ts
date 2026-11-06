/**
 * A fixed-capacity FIFO. Appending is O(1) per item and never copies the buffer; once full,
 * each new item evicts the oldest one. Index 0 is the oldest item.
 */
export class RingBuffer<T> {
  readonly capacity: number;
  private readonly items: Array<T | undefined>;
  private head = 0;
  private length = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`Ring capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this.items = Array.from<T | undefined>({ length: capacity });
  }

  get size(): number {
    return this.length;
  }

  /** The item at `index` (0 = oldest), or undefined when out of range. */
  at(index: number): T | undefined {
    if (index < 0 || index >= this.length) {
      return undefined;
    }
    return this.items[(this.head + index) % this.capacity];
  }

  first(): T | undefined {
    return this.at(0);
  }

  last(): T | undefined {
    return this.at(this.length - 1);
  }

  /** Appends `batch` and returns the items it evicted, oldest first. */
  pushAll(batch: readonly T[]): T[] {
    const evicted: T[] = [];
    for (const item of batch) {
      if (this.length < this.capacity) {
        this.items[(this.head + this.length) % this.capacity] = item;
        this.length += 1;
        continue;
      }
      const oldest = this.items[this.head];
      if (oldest !== undefined) {
        evicted.push(oldest);
      }
      this.items[this.head] = item;
      this.head = (this.head + 1) % this.capacity;
    }
    return evicted;
  }

  clear(): void {
    this.items.fill(undefined);
    this.head = 0;
    this.length = 0;
  }

  forEach(visit: (item: T, index: number) => void): void {
    for (let index = 0; index < this.length; index += 1) {
      const item = this.items[(this.head + index) % this.capacity];
      if (item !== undefined) {
        visit(item, index);
      }
    }
  }

  /** A copy, oldest first. Allocates the whole buffer: keep it out of hot paths. */
  toArray(): T[] {
    const copy: T[] = [];
    this.forEach((item) => copy.push(item));
    return copy;
  }

  /** The newest `count` items, oldest first. */
  tail(count: number): T[] {
    const start = Math.max(0, this.length - Math.max(0, count));
    const copy: T[] = [];
    for (let index = start; index < this.length; index += 1) {
      const item = this.at(index);
      if (item !== undefined) {
        copy.push(item);
      }
    }
    return copy;
  }
}
