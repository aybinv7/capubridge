import type { Bounds } from "@/types/automation.types";
import type { NativeHierarchyNode, NativeSnapshot } from "./observation";

/** Bounds attribute shape emitted by uiautomator dump: [x1,y1][x2,y2]. */
const BOUNDS_PATTERN = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/;

/** XML tokens of a uiautomator dump: comments, processing instructions, close and open tags. */
const TOKEN_PATTERN =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/(hierarchy|node)\s*>|<(hierarchy|node)\b([^<>]*?)(\/?)>/g;

/** Double-quoted XML attributes. */
const ATTRIBUTE_PATTERN = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;

/** One parsed element with its attributes and children. */
interface RawNode {
  tag: "hierarchy" | "node";
  attrs: Map<string, string>;
  children: RawNode[];
}

/**
 * Parses `uiautomator dump` XML into a native snapshot without any DOM
 * dependency, so it runs identically in tests and on the device host. The
 * dump carries no activity name, so activity stays empty; packageName is the
 * most frequent node package. Nodes without parseable bounds become
 * zero-sized and are filtered downstream by the candidate builder.
 */
export function parseUiAutomatorDump(output: string): NativeSnapshot {
  const root = scanXml(extractXml(output));
  let counter = 0;
  const packageCounts = new Map<string, number>();
  const controls: NativeSnapshot["controls"] = [];
  let webViewBounds: Bounds | undefined;
  const visit = (raw: RawNode): NativeHierarchyNode => {
    const className = raw.attrs.get("class") ?? "";
    const packageName = raw.attrs.get("package") ?? "";
    if (packageName !== "") {
      packageCounts.set(packageName, (packageCounts.get(packageName) ?? 0) + 1);
    }
    const text = raw.attrs.get("text") ?? "";
    const contentDesc = raw.attrs.get("content-desc") ?? "";
    const clickable = raw.attrs.get("clickable") === "true";
    const enabled = raw.attrs.get("enabled") !== "false";
    const bounds = parseBounds(raw.attrs.get("bounds") ?? "");
    if (bounds !== null && className.toLowerCase().includes("webview")) {
      const currentArea = bounds[2] * bounds[3];
      const previousArea = webViewBounds === undefined ? 0 : webViewBounds[2] * webViewBounds[3];
      if (currentArea > previousArea) {
        webViewBounds = bounds;
      }
    }
    const node: NativeHierarchyNode = { className };
    if (packageName !== "") {
      node.packageName = packageName;
    }
    if (clickable) {
      node.clickable = true;
    }
    if (raw.attrs.get("focused") === "true") {
      node.focused = true;
    }
    if (bounds !== null) {
      node.bounds = bounds;
    }
    const children = raw.children.map((child) => visit(child));
    if (children.length > 0) {
      node.children = children;
    }
    if (raw.tag === "node") {
      controls.push({
        index: counter,
        bounds: bounds ?? [0, 0, 0, 0],
        className,
        text,
        contentDesc,
        clickable,
        enabled,
      });
      counter += 1;
    }
    return node;
  };
  const hierarchy = root.children.map((child) => visit(child));
  return {
    controls,
    packageName: mostFrequent(packageCounts),
    activity: "",
    hierarchy,
    ...(webViewBounds === undefined ? {} : { webViewBounds }),
  };
}

/**
 * Scans one hierarchy document into raw nodes. Throws on mismatched,
 * unclosed or missing tags rather than guessing.
 */
function scanXml(xml: string): RawNode {
  const stack: RawNode[] = [];
  let root: RawNode | null = null;
  TOKEN_PATTERN.lastIndex = 0;
  let match = TOKEN_PATTERN.exec(xml);
  while (match !== null) {
    const closeTag = match[1] as "hierarchy" | "node" | undefined;
    const openTag = match[2] as "hierarchy" | "node" | undefined;
    if (closeTag !== undefined) {
      const open = stack.pop();
      if (open === undefined || open.tag !== closeTag) {
        throw new Error("uiautomator dump has mismatched tags");
      }
      if (stack.length === 0) {
        root = open;
      }
    } else if (openTag !== undefined) {
      const node: RawNode = { tag: openTag, attrs: readAttributes(match[3] ?? ""), children: [] };
      const parent = stack[stack.length - 1];
      if (parent !== undefined) {
        parent.children.push(node);
      } else if (root !== null) {
        throw new Error("uiautomator dump has content outside its root");
      }
      if (match[4] !== "/") {
        stack.push(node);
      } else if (parent === undefined) {
        root = node;
      }
    }
    match = TOKEN_PATTERN.exec(xml);
  }
  if (root === null || stack.length > 0) {
    throw new Error("uiautomator dump is not valid XML");
  }
  if (root.tag !== "hierarchy") {
    throw new Error("uiautomator dump carries no hierarchy root");
  }
  return root;
}

/**
 * Reads the attributes of one open tag.
 */
function readAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match = ATTRIBUTE_PATTERN.exec(source);
  while (match !== null) {
    attrs.set(match[1], match[2]);
    match = ATTRIBUTE_PATTERN.exec(source);
  }
  return attrs;
}

/**
 * Extracts the XML payload from dump output, tolerating prologs and tool chatter.
 */
function extractXml(output: string): string {
  const prolog = output.indexOf("<?xml");
  const hierarchy = output.indexOf("<hierarchy");
  const candidates = [prolog, hierarchy].filter((index) => index >= 0);
  if (candidates.length === 0) {
    throw new Error("uiautomator dump carries no XML payload");
  }
  return output.slice(Math.min(...candidates));
}

/**
 * Parses a bounds attribute into [x, y, width, height]. Returns null when missing.
 */
function parseBounds(value: string): Bounds | null {
  const match = BOUNDS_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  return [x1, y1, Math.max(0, x2 - x1), Math.max(0, y2 - y1)];
}

/**
 * Returns the most frequent package, or an empty string when none was seen.
 */
function mostFrequent(counts: Map<string, number>): string {
  let best = "";
  let bestCount = 0;
  for (const [packageName, count] of counts) {
    if (count > bestCount) {
      best = packageName;
      bestCount = count;
    }
  }
  return best;
}
