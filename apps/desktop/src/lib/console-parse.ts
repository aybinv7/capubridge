import type { ConsoleArg, ConsolePrimitiveType, ConsoleProp } from "@/types/console.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const PRIMITIVE_TYPES: ReadonlySet<string> = new Set([
  "string",
  "number",
  "bigint",
  "boolean",
  "undefined",
  "symbol",
  "function",
]);

function primitiveType(type: unknown, subtype?: unknown): ConsolePrimitiveType | undefined {
  if (subtype === "null") return "null";
  return typeof type === "string" && PRIMITIVE_TYPES.has(type)
    ? (type as ConsolePrimitiveType)
    : undefined;
}

function primitive(text: string, type: unknown, subtype?: unknown): ConsoleArg {
  const valueType = primitiveType(type, subtype);
  return valueType ? { kind: "primitive", text, valueType } : { kind: "primitive", text };
}

function formatJsonValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    const json = JSON.stringify(value, null, 2);
    if (json !== undefined) return json;
  } catch {
    return Object.prototype.toString.call(value);
  }
  return Object.prototype.toString.call(value);
}

export function parsePropertyPreview(p: Record<string, unknown>): ConsoleArg {
  if (isRecord(p.valuePreview)) {
    const vp = p.valuePreview as Record<string, unknown>;
    const desc =
      typeof vp.description === "string"
        ? vp.description
        : typeof vp.type === "string"
          ? vp.type
          : "Object";
    const subtype = typeof vp.subtype === "string" ? vp.subtype : null;
    const overflow = Boolean(vp.overflow);
    const props: ConsoleProp[] = Array.isArray(vp.properties)
      ? (vp.properties as Array<Record<string, unknown>>).map((np) => ({
          name: typeof np.name === "string" ? np.name : "?",
          value: parsePropertyPreview(np),
        }))
      : [];
    return {
      kind: "object",
      description: desc,
      subtype,
      properties: props,
      overflow,
      objectId: null,
    };
  }

  const type = typeof p.type === "string" ? p.type : "";
  if (type === "object" || type === "function") {
    const desc =
      typeof p.value === "string" && p.value ? p.value : type === "function" ? "ƒ" : "Object";
    const subtype = typeof p.subtype === "string" ? p.subtype : null;
    return {
      kind: "object",
      description: desc,
      subtype,
      properties: [],
      overflow: false,
      objectId: null,
    };
  }

  if (typeof p.value === "string") {
    return primitive(p.value, type, p.subtype);
  }
  if (type) {
    return primitive(type, type, p.subtype);
  }
  return { kind: "primitive", text: "" };
}

export function parseRemoteValue(value: unknown): ConsoleArg {
  if (!isRecord(value)) {
    return { kind: "primitive", text: formatJsonValue(value) };
  }

  if (typeof value.unserializableValue === "string") {
    return primitive(value.unserializableValue, value.type);
  }

  if ("value" in value) {
    return primitive(formatJsonValue(value.value), value.type, value.subtype);
  }

  if (value.subtype === "null") {
    return primitive("null", "object", "null");
  }

  const isObjectLike =
    value.type === "object" ||
    value.type === "function" ||
    typeof value.objectId === "string" ||
    isRecord(value.preview);

  if (!isObjectLike) {
    if (typeof value.description === "string") {
      return primitive(value.description, value.type);
    }
    if (typeof value.type === "string") {
      return primitive(value.type, value.type);
    }
    return { kind: "primitive", text: "[unknown]" };
  }

  const desc =
    typeof value.description === "string" && value.description
      ? value.description
      : typeof value.type === "string"
        ? value.type
        : "Object";
  const subtype = typeof value.subtype === "string" ? value.subtype : null;
  const objectId = typeof value.objectId === "string" ? value.objectId : null;

  let properties: ConsoleProp[] = [];
  let overflow = false;

  if (isRecord(value.preview)) {
    overflow = Boolean(value.preview.overflow);
    if (Array.isArray(value.preview.properties)) {
      properties = (value.preview.properties as Array<Record<string, unknown>>).map((p) => ({
        name: typeof p.name === "string" ? p.name : "?",
        value: parsePropertyPreview(p),
      }));
    }
  }

  return {
    kind: "object",
    description: desc,
    subtype,
    properties,
    overflow,
    objectId,
  };
}

export function flattenArgsForMessage(args: ConsoleArg[]): string {
  return args
    .map((a) => (a.kind === "primitive" ? a.text : a.description))
    .join(" ")
    .trim();
}
