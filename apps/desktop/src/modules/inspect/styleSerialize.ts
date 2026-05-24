import type { CSSProperty } from "utils";

export function serializeProperties(properties: CSSProperty[]): string {
  const lines: string[] = [];
  for (const p of properties) {
    if (!p.name) continue;
    const value = p.value;
    if (!value && !p.disabled) continue;
    const important = p.important ? " !important" : "";
    const decl = `${p.name}: ${value}${important};`;
    lines.push(p.disabled ? `/* ${decl} */` : `  ${decl}`);
  }
  if (!lines.length) return "";
  return `\n${lines.map((l) => (l.startsWith("/*") ? `  ${l}` : l)).join("\n")}\n`;
}

export function applyPropertyChange(
  props: CSSProperty[],
  index: number,
  next: { name: string; value: string; disabled: boolean; important?: boolean },
): CSSProperty[] {
  const copy = props.slice();
  const updated: CSSProperty = {
    name: next.name,
    value: next.value,
    disabled: next.disabled,
    important: next.important,
  };
  if (index < 0 || index >= copy.length) {
    copy.push(updated);
  } else {
    copy[index] = { ...copy[index], ...updated };
  }
  return copy;
}

export function removePropertyAt(props: CSSProperty[], index: number): CSSProperty[] {
  if (index < 0 || index >= props.length) return props.slice();
  const copy = props.slice();
  copy.splice(index, 1);
  return copy;
}

export function parseShorthandInput(input: string): CSSProperty | null {
  const trimmed = input.trim().replace(/;$/, "");
  if (!trimmed) return null;
  const colon = trimmed.indexOf(":");
  if (colon < 0) return null;
  const name = trimmed.slice(0, colon).trim();
  let value = trimmed.slice(colon + 1).trim();
  if (!name || !value) return null;
  let important = false;
  if (/!important$/i.test(value)) {
    important = true;
    value = value.replace(/!important$/i, "").trim();
  }
  return { name, value, important };
}
