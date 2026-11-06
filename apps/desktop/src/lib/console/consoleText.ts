import type { ConsoleArg } from "@/types/console.types";
import { valuePreview } from "./consolePreview";

const SPECIFIER = /%([sdifoOc%])/g;

/** A primitive as its text; an object as its preview, so search and copy see its fields. */
function argText(arg: ConsoleArg): string {
  if (arg.kind === "primitive") return arg.text;
  return valuePreview(arg)
    .map((segment) => segment.text)
    .join("");
}

function substitute(kind: string, arg: ConsoleArg | undefined): string {
  if (!arg) return `%${kind}`;
  if (kind === "s" || kind === "o" || kind === "O") return argText(arg);
  const text = argText(arg);
  if (kind === "f") return String(Number.parseFloat(text));
  return String(Number.parseInt(text, 10));
}

/**
 * The plain text of a console call, as DevTools would print it: `%s %d %i %f %o %O` take the
 * next arguments, `%c` takes its CSS argument and prints nothing, `%%` is a percent sign, and
 * the arguments left over follow, separated by spaces.
 */
export function consoleCallText(args: readonly ConsoleArg[]): string {
  const first = args[0];
  if (!first) return "";
  if (first.kind !== "primitive" || !first.text.includes("%")) {
    return args.map(argText).join(" ").trim();
  }
  let next = 1;
  const head = first.text.replace(SPECIFIER, (_match, kind: string) => {
    if (kind === "%") return "%";
    const arg = args[next];
    next += 1;
    return kind === "c" ? "" : substitute(kind, arg);
  });
  const rest = args.slice(next).map(argText);
  return [head, ...rest].join(" ").trim();
}
