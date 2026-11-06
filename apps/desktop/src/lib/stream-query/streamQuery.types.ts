/** How a term compares its value: substring, whole value, or regular expression. */
export type QueryOperator = "contains" | "exact" | "regex";

/**
 * One term of a stream query: `tag:Foo`, `-tag:Foo`, `tag~:^Fo+`, `tag=:Foo`, a bare word, or
 * a `/regex/`. `key` is null for free text. `start`/`end` are offsets in the source, so a term
 * can be replaced or removed without re-printing the whole query.
 */
export interface QueryTerm {
  key: string | null;
  value: string;
  negate: boolean;
  operator: QueryOperator;
  start: number;
  end: number;
}

/** Something in the query that cannot be applied, said plainly, with where it is. */
export interface QueryProblem {
  start: number;
  end: number;
  message: string;
}

export interface ParsedQuery {
  source: string;
  terms: QueryTerm[];
}

/** The fields and rules a stream gives the shared compiler. */
export interface StreamQuerySchema<T> {
  /** Keys this stream understands; any other `key:value` is free text. */
  keys: readonly string[];
  /** Lowercased text that free text and `/regex/` search, cached per item by the stream. */
  text(item: T): string;
  /** Raw value of a plain field (`tag`, `url`, ...), or null when the item has none. */
  field(item: T, key: string): string | null;
  /** Rank of the item's level; `level:X` keeps items whose rank is at least X's. */
  levelRank(item: T): number;
  /** Rank of a level the user typed, or null when it is not a level of this stream. */
  parseLevel(value: string): number | null;
  /** Host time of the item, for `age:`. */
  time(item: T): number;
  /** `is:` checks this stream knows. */
  is: Readonly<Record<string, (item: T) => boolean>>;
  /**
   * Turns a typed value into the value to match (`package:mine` into the app's package), or a
   * problem when it cannot be resolved. Values it leaves alone return `undefined`.
   */
  resolve?(key: string, value: string): { value: string } | { problem: string } | undefined;
}

export interface CompiledQuery<T> {
  /** null when the query lets everything through, so a view can skip testing. */
  predicate: ((item: T) => boolean) | null;
  problems: QueryProblem[];
  /** True when the result changes with time alone (`age:`), so views refresh it now and then. */
  timeSensitive: boolean;
  /** The lowest level rank the query keeps, or null when it does not filter by level. */
  levelFloor: number | null;
}
