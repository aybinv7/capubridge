/** Field name that marks a non-JSON value read from IndexedDB. */
export const IDB_MARKER_KEY = "__type";

/** A typed-array or DataView marker. */
export interface IdbBinaryMarker {
  __type:
    | "ArrayBuffer"
    | "DataView"
    | "Int8Array"
    | "Uint8Array"
    | "Uint8ClampedArray"
    | "Int16Array"
    | "Uint16Array"
    | "Int32Array"
    | "Uint32Array"
    | "Float32Array"
    | "Float64Array"
    | "BigInt64Array"
    | "BigUint64Array";
  byteLength: number;
  length?: number;
  base64?: string;
}

/**
 * The JSON shape of a value IndexedDB holds but JSON cannot carry. Records read from the
 * device carry these in place of the real value; device scripts revive them on the way back.
 */
export type IdbMarker =
  | { __type: "Date"; value: string }
  | { __type: "BigInt"; value: string }
  | IdbBinaryMarker
  | {
      __type: "Blob" | "File";
      size: number;
      type: string;
      name?: string;
      lastModified?: number;
      base64?: string;
    }
  | { __type: "Map"; size: number; entries: [unknown, unknown][] }
  | { __type: "Set"; size: number; values: unknown[] }
  | { __type: "Undefined" }
  | { __type: "Number"; value: "NaN" | "Infinity" | "-Infinity" | "-0" }
  | { __type: "RegExp"; source: string; flags: string }
  | { __type: "Error"; name: string; message: string }
  | { __type: "Escaped"; value: Record<string, unknown> }
  | { __type: "Unsupported"; kind: string }
  | { __type: "Circular" }
  | { __type: "MaxDepth" }
  | { __type: "MaxNodes" }
  | { __type: "TooLarge"; bytes: number };

/** The first value inside a record that JSON cannot carry, as found by the device encoder. */
export interface IdbValueIssue {
  /** Marker type, or `Reserved` (a plain object using `__type`) or `PageBudget`. */
  type: string;
  /** Dotted path from the record root; `""` is the whole value. */
  path: string;
}

/** Limits for one encoder run on the device. */
export interface IdbEncodeLimits {
  binaryLimit: number;
  maxDepth: number;
  maxNodes: number;
  maxValueBytes: number;
  pageBytes: number;
}

/** Limits used when reading records for display: binary up to 64 KiB, 1 MiB per value, 12 MiB per page. */
export const IDB_VIEW_LIMITS: IdbEncodeLimits = {
  binaryLimit: 64 * 1024,
  maxDepth: 12,
  maxNodes: 20_000,
  maxValueBytes: 1024 * 1024,
  pageBytes: 12 * 1024 * 1024,
};

/**
 * Device-side encoder and reviver, as JavaScript source to paste into a device script. It
 * defines `__cbCodec(options)`, `__cbRecordEncoder(limits)`, `__cbRevive(value, lenient)`,
 * `__cbOpenExisting(name)` (never creates a database), `__cbCheckOrigin(origin)`,
 * `__cbKeyText(key)`, `__cbRequest(req)`, `__cbTxDone(tx)` and `__cbRange(spec)`.
 */
export const IDB_DEVICE_CODEC_SOURCE = String.raw`
function __cbBytesToB64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  }
  return btoa(binary);
}
function __cbB64ToBytes(text) {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
function __cbIsPlain(value) {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
}
function __cbCodec(options) {
  const binaryLimit = options.binaryLimit;
  const maxDepth = options.maxDepth;
  const maxNodes = options.maxNodes;
  const escape = Boolean(options.escape);
  const collectBlobs = Boolean(options.collectBlobs);
  const blobs = [];
  const LOSSY = { Circular: 'refers back to itself', MaxDepth: 'is nested too deeply', MaxNodes: 'has too many parts', Error: 'is an Error (only its name and message are kept)', Unsupported: 'is a kind of object that cannot be saved to a file', TooLarge: 'is too large' };
  function encode(input) {
    let nodes = 0;
    let issue = null;
    let binaryBytes = 0;
    const lossy = [];
    const stack = [];
    const path = [];
    function where() {
      let text = '';
      for (const part of path) {
        if (typeof part === 'number') text += '[' + part + ']';
        else text += (text ? '.' : '') + part;
      }
      return text;
    }
    function note(type) {
      if (!issue) issue = { type: type, path: where() };
      if (LOSSY[type]) lossy.push((where() ? '"' + where() + '" ' : 'A value ') + LOSSY[type]);
    }
    function mark(type, extra) {
      note(type);
      return Object.assign({ __type: type }, extra || {});
    }
    function binary(type, bytes, extra) {
      binaryBytes += bytes.length;
      const marker = mark(type, extra);
      if (bytes.length <= binaryLimit) marker.base64 = __cbBytesToB64(bytes);
      return marker;
    }
    function walk(value, depth) {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
      if (typeof value === 'number') {
        if (Number.isNaN(value)) return mark('Number', { value: 'NaN' });
        if (value === Infinity) return mark('Number', { value: 'Infinity' });
        if (value === -Infinity) return mark('Number', { value: '-Infinity' });
        if (Object.is(value, -0)) return mark('Number', { value: '-0' });
        return value;
      }
      if (value === undefined) return mark('Undefined');
      if (typeof value === 'bigint') return mark('BigInt', { value: value.toString() });
      if (typeof value !== 'object') return mark('Unsupported', { kind: typeof value });
      if (depth >= maxDepth) return mark('MaxDepth');
      nodes += 1;
      if (nodes > maxNodes) return mark('MaxNodes');
      if (stack.indexOf(value) !== -1) return mark('Circular');
      if (value instanceof Date) {
        return mark('Date', { value: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString() });
      }
      if (value instanceof ArrayBuffer) {
        return binary('ArrayBuffer', new Uint8Array(value), { byteLength: value.byteLength });
      }
      if (ArrayBuffer.isView(value)) {
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        const extra = { byteLength: value.byteLength };
        if (!(value instanceof DataView)) extra.length = value.length;
        return binary(value instanceof DataView ? 'DataView' : value.constructor.name, bytes, extra);
      }
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        const isFile = typeof File !== 'undefined' && value instanceof File;
        const marker = mark(isFile ? 'File' : 'Blob', { size: value.size, type: value.type });
        if (isFile) {
          marker.name = value.name;
          marker.lastModified = value.lastModified;
        }
        binaryBytes += value.size;
        if (collectBlobs) blobs.push({ marker: marker, blob: value });
        return marker;
      }
      if (value instanceof RegExp) return mark('RegExp', { source: value.source, flags: value.flags });
      if (value instanceof Error) return mark('Error', { name: String(value.name), message: String(value.message) });
      if (value instanceof Map) {
        stack.push(value);
        const entries = [];
        let index = 0;
        for (const entry of value) {
          path.push(index);
          entries.push([walk(entry[0], depth + 1), walk(entry[1], depth + 1)]);
          path.pop();
          index += 1;
        }
        stack.pop();
        return mark('Map', { size: value.size, entries: entries });
      }
      if (value instanceof Set) {
        stack.push(value);
        const values = [];
        let index = 0;
        for (const entry of value) {
          path.push(index);
          values.push(walk(entry, depth + 1));
          path.pop();
          index += 1;
        }
        stack.pop();
        return mark('Set', { size: value.size, values: values });
      }
      if (Array.isArray(value)) {
        stack.push(value);
        const out = new Array(value.length);
        for (let i = 0; i < value.length; i += 1) {
          path.push(i);
          out[i] = i in value ? walk(value[i], depth + 1) : mark('Undefined');
          path.pop();
        }
        stack.pop();
        return out;
      }
      if (__cbIsPlain(value)) {
        stack.push(value);
        const out = {};
        for (const key of Object.keys(value)) {
          path.push(key);
          out[key] = walk(value[key], depth + 1);
          path.pop();
        }
        stack.pop();
        if (Object.prototype.hasOwnProperty.call(value, '__type')) {
          if (escape) return { __type: 'Escaped', value: out };
          note('Reserved');
        }
        return out;
      }
      return mark('Unsupported', { kind: (value.constructor && value.constructor.name) || 'Object' });
    }
    const value = walk(input, 0);
    return { value: value, issue: issue, lossy: lossy, binaryBytes: binaryBytes };
  }
  async function fill() {
    for (const entry of blobs.splice(0)) {
      entry.marker.base64 = __cbBytesToB64(new Uint8Array(await entry.blob.arrayBuffer()));
    }
  }
  return { encode: encode, fill: fill };
}
function __cbRecordEncoder(limits) {
  const keys = __cbCodec({ binaryLimit: Infinity, maxDepth: 32, maxNodes: 10000 });
  const values = __cbCodec({ binaryLimit: limits.binaryLimit, maxDepth: limits.maxDepth, maxNodes: limits.maxNodes });
  let used = 0;
  return function (key, primaryKey, value) {
    const k = keys.encode(key);
    const p = keys.encode(primaryKey);
    let v = values.encode(value);
    const text = JSON.stringify(v.value);
    const bytes = text === undefined ? 0 : text.length;
    if (bytes > limits.maxValueBytes) {
      v = { value: { __type: 'TooLarge', bytes: bytes }, issue: { type: 'TooLarge', path: '' } };
    } else if (used + bytes > limits.pageBytes) {
      v = { value: { __type: 'TooLarge', bytes: bytes }, issue: { type: 'PageBudget', path: '' } };
    } else {
      used += bytes;
    }
    return { k: k.value, p: p.value, v: v.value, ik: k.issue, ip: p.issue, iv: v.issue };
  };
}
function __cbStaged(id) {
  const stage = globalThis.__cbImportBinary;
  const parts = stage && stage[id];
  if (!parts) throw new Error('Part of a large value did not arrive on the phone; nothing was written');
  delete stage[id];
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function __cbNeedBytes(marker, lenient) {
  if (typeof marker.base64 === 'string') return __cbB64ToBytes(marker.base64);
  if (typeof marker.staged === 'string') return __cbStaged(marker.staged);
  if (lenient) return new Uint8Array(0);
  throw new Error('The ' + marker.__type + ' data was not read, so it cannot be sent back');
}
function __cbRevive(value, lenient) {
  if (Array.isArray(value)) return value.map(function (entry) { return __cbRevive(entry, lenient); });
  if (value === null || typeof value !== 'object') return value;
  const type = value.__type;
  if (typeof type !== 'string') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = __cbRevive(value[key], lenient);
    return out;
  }
  switch (type) {
    case 'Escaped': {
      const out = {};
      const inner = value.value || {};
      for (const key of Object.keys(inner)) out[key] = __cbRevive(inner[key], lenient);
      return out;
    }
    case 'Date': return new Date(value.value === 'Invalid Date' ? NaN : value.value);
    case 'BigInt': return BigInt(value.value);
    case 'Number':
      if (value.value === 'NaN') return NaN;
      if (value.value === 'Infinity') return Infinity;
      if (value.value === '-Infinity') return -Infinity;
      return -0;
    case 'Undefined': return undefined;
    case 'RegExp': return new RegExp(value.source, value.flags);
    case 'Error': {
      const error = new Error(value.message);
      error.name = value.name;
      return error;
    }
    case 'Map': return new Map((value.entries || []).map(function (entry) { return [__cbRevive(entry[0], lenient), __cbRevive(entry[1], lenient)]; }));
    case 'Set': return new Set((value.values || []).map(function (entry) { return __cbRevive(entry, lenient); }));
    case 'File': return new File([__cbNeedBytes(value, lenient)], value.name || 'file', { type: value.type, lastModified: value.lastModified });
    case 'Blob': return new Blob([__cbNeedBytes(value, lenient)], { type: value.type });
    case 'ArrayBuffer': return __cbNeedBytes(value, lenient).buffer;
    case 'DataView': return new DataView(__cbNeedBytes(value, lenient).buffer);
    case 'Circular':
    case 'MaxDepth':
    case 'MaxNodes':
    case 'TooLarge':
    case 'Unsupported':
      if (lenient) return null;
      throw new Error('A value that was not read in full (' + type + ') cannot be sent back');
    default:
      if (/Array$/.test(type) && typeof globalThis[type] === 'function' && 'byteLength' in value) {
        return new globalThis[type](__cbNeedBytes(value, lenient).buffer);
      }
      {
        const out = {};
        for (const key of Object.keys(value)) out[key] = __cbRevive(value[key], lenient);
        return out;
      }
  }
}
function __cbRequest(req) {
  return new Promise(function (resolve, reject) {
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error && req.error.message ? req.error.message : 'request failed'); };
  });
}
function __cbTxDone(tx) {
  return new Promise(function (resolve, reject) {
    tx.oncomplete = function () { resolve(true); };
    tx.onerror = function () { reject(tx.error && tx.error.message ? tx.error.message : 'transaction failed'); };
    tx.onabort = function () { reject(tx.error && tx.error.message ? tx.error.message : 'transaction aborted'); };
  });
}
async function __cbOpenExisting(name) {
  const absent = 'Database "' + name + '" does not exist on this page';
  if (typeof indexedDB.databases === 'function') {
    const existing = await indexedDB.databases();
    if (!existing.some(function (entry) { return entry.name === name; })) throw new Error(absent);
  }
  return new Promise(function (resolve, reject) {
    let created = false;
    const req = indexedDB.open(name);
    req.onupgradeneeded = function (event) {
      if (event.oldVersion !== 0) return;
      created = true;
      req.transaction.abort();
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function (event) {
      if (event && event.preventDefault) event.preventDefault();
      reject(created ? new Error(absent) : (req.error && req.error.message ? req.error.message : 'open failed'));
    };
  });
}
function __cbCheckOrigin(origin) {
  if (!origin || location.origin !== origin) {
    throw new Error('The database belongs to another origin (' + (origin || 'none given') + ') than this page (' + location.origin + '); nothing was changed');
  }
}
function __cbKeyText(key) {
  const encoded = __cbCodec({ binaryLimit: 0, maxDepth: 8, maxNodes: 200 }).encode(key).value;
  if (encoded && typeof encoded === 'object' && encoded.__type === 'Date') return encoded.value;
  return JSON.stringify(encoded);
}
function __cbRange(spec) {
  if (!spec) return undefined;
  const lower = spec.lower === undefined ? undefined : __cbRevive(spec.lower, false);
  const upper = spec.upper === undefined ? undefined : __cbRevive(spec.upper, false);
  if (lower !== undefined && upper !== undefined) return IDBKeyRange.bound(lower, upper, Boolean(spec.lowerOpen), Boolean(spec.upperOpen));
  if (lower !== undefined) return IDBKeyRange.lowerBound(lower, Boolean(spec.lowerOpen));
  if (upper !== undefined) return IDBKeyRange.upperBound(upper, Boolean(spec.upperOpen));
  return undefined;
}
`;
