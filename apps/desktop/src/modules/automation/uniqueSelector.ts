/**
 * Builds a CSS selector that matches exactly this element and nothing else.
 *
 * Page-stacking frameworks such as Framework7 and Ionic keep every visited
 * page mounted with identical structure, so a fixed-depth positional path is
 * ambiguous: on Presalio a 5-level path for the Stock search icon matched 3
 * elements and `querySelector` returned a hidden page's navbar button. This
 * climbs until the path is unique, anchoring on a unique id or test id when
 * one exists.
 *
 * Runs inside the page: it is serialized with `Function.prototype.toString`,
 * so it must reference nothing outside its own body.
 */
export function uniqueSelector(element: Element): string {
  const doc = element.ownerDocument;
  const escape = (value: string): string =>
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(value)
      : value.replace(/([^\w-])/g, "\\$1");
  const matchesOne = (selector: string): boolean => {
    try {
      return doc.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };
  if (element.id !== "") {
    const byId = `#${escape(element.id)}`;
    if (matchesOne(byId)) {
      return byId;
    }
  }
  const testId = element.getAttribute("data-testid");
  if (testId !== null && testId !== "") {
    const byTestId = `[data-testid="${escape(testId)}"]`;
    if (matchesOne(byTestId)) {
      return byTestId;
    }
  }
  const parts: string[] = [];
  let current: Element | null = element;
  while (current !== null) {
    if (current !== element && current.id !== "") {
      const anchored = [`#${escape(current.id)}`, ...parts].join(" > ");
      if (matchesOne(anchored)) {
        return anchored;
      }
    }
    const parent: Element | null = current.parentElement;
    let part = current.tagName.toLowerCase();
    if (parent !== null) {
      const tag = current.tagName;
      const siblings = Array.from(parent.children).filter((child) => child.tagName === tag);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(part);
    if (parts.length >= 3 && matchesOne(parts.join(" > "))) {
      return parts.join(" > ");
    }
    current = parent;
  }
  return parts.join(" > ");
}

/**
 * Resolves a selector only when it matches exactly one element. An action
 * must never land on "the first match": that is how a tap aimed at a visible
 * control was delivered to a hidden page. Ambiguous or invalid selectors
 * resolve to null so the caller falls back to a device tap at the verified
 * point.
 *
 * Runs inside the page: serialized with `Function.prototype.toString`.
 */
export function resolveUnique(doc: Document, selector: string): Element | null {
  try {
    const matches = doc.querySelectorAll(selector);
    return matches.length === 1 ? (matches[0] ?? null) : null;
  } catch {
    return null;
  }
}
