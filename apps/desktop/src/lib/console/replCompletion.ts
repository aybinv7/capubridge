import { isRecord } from "@/lib/console/consoleFormat";

/** The part of a CDP client completion needs. */
export interface CompletionClient {
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
}

/** What is being completed: names on `objectExpr` (or globals when null) starting with `prefix`. */
export interface CompletionContext {
  objectExpr: string | null;
  prefix: string;
  /** Where the prefix starts in the prompt text; a pick replaces from here to the caret. */
  from: number;
}

const MEMBER = /([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*|\[\d+\])*)\??\.([\w$]*)$/;
const IDENTIFIER = /([A-Za-z_$][\w$]*)$/;

/**
 * Reads what the caret is completing: `window.loc|` completes `loc` on `window`, `doc|`
 * completes a global. Calls and computed keys are left alone, so completion never runs code.
 */
export function completionContext(text: string, caret: number): CompletionContext | null {
  const before = text.slice(0, caret);
  const member = MEMBER.exec(before);
  if (member) {
    const prefix = member[2] ?? "";
    return { objectExpr: member[1] ?? null, prefix, from: caret - prefix.length };
  }
  const identifier = IDENTIFIER.exec(before);
  if (identifier) {
    const prefix = identifier[1] ?? "";
    return { objectExpr: null, prefix, from: caret - prefix.length };
  }
  return before === "" || /[\s(,;=!&|?:+\-*/%<>[{]$/.test(before)
    ? { objectExpr: null, prefix: "", from: caret }
    : null;
}

function propertyNamesExpression(objectExpr: string): string {
  return `(() => {
    const names = new Set();
    let target = (${objectExpr});
    if (target === null || target === undefined) return [];
    target = Object(target);
    while (target && names.size < 2000) {
      for (const name of Object.getOwnPropertyNames(target)) names.add(name);
      target = Object.getPrototypeOf(target);
    }
    return [...names];
  })()`;
}

async function evaluateNames(client: CompletionClient, expression: string): Promise<string[]> {
  const response = await client.send<{ result?: unknown; exceptionDetails?: unknown }>(
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
      throwOnSideEffect: true,
      silent: true,
      timeout: 500,
    },
  );
  if (response.exceptionDetails || !isRecord(response.result)) return [];
  const value = response.result.value;
  return Array.isArray(value)
    ? value.filter((name): name is string => typeof name === "string")
    : [];
}

/**
 * Names that can follow `objectExpr` (or every global, with lexical `let`/`const` names first).
 * Evaluated with `throwOnSideEffect`, so a getter that would change the app is refused.
 */
export async function fetchCompletionNames(
  client: CompletionClient,
  objectExpr: string | null,
): Promise<string[]> {
  if (objectExpr !== null) return evaluateNames(client, propertyNamesExpression(objectExpr));
  const [lexical, globals] = await Promise.all([
    client
      .send<{ names?: unknown }>("Runtime.globalLexicalScopeNames", {})
      .then((result) =>
        Array.isArray(result.names)
          ? result.names.filter((name): name is string => typeof name === "string")
          : [],
      ),
    evaluateNames(client, propertyNamesExpression("globalThis")),
  ]);
  return [...new Set([...lexical, ...globals])];
}

/** The names that start with `prefix`, case-sensitive matches first, at most `limit`. */
export function rankCompletions(names: readonly string[], prefix: string, limit = 40): string[] {
  const lower = prefix.toLowerCase();
  const exact: string[] = [];
  const loose: string[] = [];
  for (const name of names) {
    if (name === prefix) continue;
    if (name.startsWith(prefix)) exact.push(name);
    else if (name.toLowerCase().startsWith(lower)) loose.push(name);
  }
  const byName = (a: string, b: string) =>
    Number(a.startsWith("_")) - Number(b.startsWith("_")) || a.localeCompare(b);
  return [...exact.sort(byName), ...loose.sort(byName)].slice(0, limit);
}
