import type {
  CompiledQuery,
  ParsedQuery,
  QueryProblem,
  QueryTerm,
  StreamQuerySchema,
} from "./streamQuery.types";

type Check<T> = (item: T) => boolean;

const DURATION = /^(\d+(?:\.\d+)?)(s|m|h|d)$/i;
const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** `30s`, `5m`, `2h`, `1d` in milliseconds, or null when it is not a duration. */
export function parseDuration(value: string): number | null {
  const match = DURATION.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * (UNIT_MS[(match[2] ?? "").toLowerCase()] ?? 0);
}

function problem(term: QueryTerm, message: string): QueryProblem {
  return { start: term.start, end: term.end, message };
}

function textMatcher(
  term: QueryTerm,
  problems: QueryProblem[],
): ((text: string) => boolean) | null {
  if (term.operator === "regex") {
    try {
      const pattern = new RegExp(term.value, "i");
      return (text) => pattern.test(text);
    } catch (error) {
      problems.push(problem(term, `This pattern is not valid: ${(error as Error).message}`));
      return null;
    }
  }
  if (term.operator === "exact") {
    const value = term.value;
    return (text) => text === value;
  }
  const needle = term.value.toLowerCase();
  return (text) => text.toLowerCase().includes(needle);
}

function anyOf<T>(checks: Check<T>[]): Check<T> {
  if (checks.length === 1) return checks[0] as Check<T>;
  return (item) => checks.some((check) => check(item));
}

interface Groups<T> {
  positive: Map<string, Check<T>[]>;
  negative: Check<T>[];
}

function add<T>(groups: Groups<T>, key: string, negate: boolean, check: Check<T>) {
  if (negate) {
    groups.negative.push(check);
    return;
  }
  const list = groups.positive.get(key);
  if (list) list.push(check);
  else groups.positive.set(key, [check]);
}

function compileFreeText<T>(
  term: QueryTerm,
  schema: StreamQuerySchema<T>,
  problems: QueryProblem[],
): Check<T> | null {
  if (term.operator === "regex") {
    const match = textMatcher(term, problems);
    return match ? (item) => match(schema.text(item)) : null;
  }
  const needle = term.value.toLowerCase();
  return (item) => schema.text(item).includes(needle);
}

function compileField<T>(
  term: QueryTerm,
  key: string,
  schema: StreamQuerySchema<T>,
  problems: QueryProblem[],
): Check<T> | null {
  const resolved = schema.resolve?.(key, term.value);
  if (resolved && "problem" in resolved) {
    problems.push(problem(term, resolved.problem));
    return () => false;
  }
  const value = resolved ? resolved.value : term.value;
  const match = textMatcher({ ...term, value }, problems);
  if (!match) return null;
  return (item) => {
    const field = schema.field(item, key);
    return field !== null && match(field);
  };
}

/**
 * Turns parsed terms into one predicate. Positive terms with the same key are OR'd (`tag:A
 * tag:B` keeps either tag); different keys are AND'd; every negated term must not match.
 * `level:W` keeps W and above; `age:5m` keeps the last five minutes. Terms that cannot apply
 * are reported as problems and left out, so a typo never empties the view silently.
 */
export function compileQuery<T>(
  parsed: ParsedQuery,
  schema: StreamQuerySchema<T>,
  now: () => number = Date.now,
): CompiledQuery<T> {
  const problems: QueryProblem[] = [];
  const groups: Groups<T> = { positive: new Map(), negative: [] };
  const floors: number[] = [];
  let timeSensitive = false;

  for (const term of parsed.terms) {
    const key = term.key;
    if (key === null) {
      const check = compileFreeText(term, schema, problems);
      if (check) add(groups, `text:${term.start}`, term.negate, check);
      continue;
    }
    if (!term.value) {
      problems.push(problem(term, `Add a value after ${key}:`));
      continue;
    }

    if (key === "level") {
      const rank = schema.parseLevel(term.value);
      if (rank === null) {
        problems.push(problem(term, `"${term.value}" is not a level here`));
        continue;
      }
      if (!term.negate) floors.push(rank);
      add(groups, key, term.negate, (item) => schema.levelRank(item) >= rank);
      continue;
    }

    if (key === "age") {
      const span = parseDuration(term.value);
      if (span === null) {
        problems.push(problem(term, `Write the age as 30s, 5m, 2h or 1d`));
        continue;
      }
      timeSensitive = true;
      add(groups, key, term.negate, (item) => schema.time(item) >= now() - span);
      continue;
    }

    if (key === "is") {
      const check = schema.is[term.value.toLowerCase()];
      if (!check) {
        const known = Object.keys(schema.is).join(", ");
        problems.push(problem(term, `is: takes ${known}`));
        continue;
      }
      add(groups, key, term.negate, check);
      continue;
    }

    const check = compileField(term, key, schema, problems);
    if (check) add(groups, key, term.negate, check);
  }

  const checks: Check<T>[] = [];
  for (const list of groups.positive.values()) checks.push(anyOf(list));
  for (const negated of groups.negative) checks.push((item) => !negated(item));

  return {
    predicate:
      checks.length === 0
        ? null
        : checks.length === 1
          ? (checks[0] as Check<T>)
          : (item) => checks.every((check) => check(item)),
    problems,
    timeSensitive,
    levelFloor: floors.length > 0 ? Math.min(...floors) : null,
  };
}
