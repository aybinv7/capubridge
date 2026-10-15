import type {
  Bounds,
  NativeObservation,
  Observation,
  SessionSignalState,
  SystemUiState,
  WebviewObservation,
} from "@/types/automation.types";

/** Stable placeholders replacing sensitive runs. Policies learn that a secret was present, never its content. */
export const REDACTION_PLACEHOLDERS = {
  jwt: "<redacted:jwt>",
  bearer: "<redacted:bearer>",
  token: "<redacted:token>",
  secret: "<redacted:secret>",
  email: "<redacted:email>",
  phone: "<redacted:phone>",
  number: "<redacted:number>",
} as const;

/** Maximum length of one recentErrors entry after masking. Longer messages are truncated. */
export const REDACTED_ERROR_MAX_LENGTH = 500;

/**
 * A WebView element safe to send off the machine. Input values are replaced
 * by a shape hint; every other text run passed through the masking rules.
 */
export interface RedactedElement {
  index: number;
  cssSelector: string;
  role: string;
  text: string;
  enabled: boolean;
  visible: boolean;
  bounds: Bounds;
  isInput: boolean;
  inputType: string | null;
  clickable?: boolean;
  name?: string;
}

/** A native control safe to send off the machine. */
export interface RedactedControl {
  index: number;
  bounds: Bounds;
  className: string;
  text: string;
  contentDesc: string;
  clickable: boolean;
  enabled: boolean;
}

/** Native layer safe to send off the machine. */
export interface RedactedNative {
  controls: RedactedControl[];
  packageName: string;
  activity: string;
  systemUi: SystemUiState;
  webViewBounds?: Bounds;
}

/** WebView layer safe to send off the machine. */
export interface RedactedWebview {
  elements: RedactedElement[];
}

/** Session signals safe to send off the machine. Screenshot references never leave. */
export interface RedactedSignals {
  pendingRequests: number;
  recentErrors: string[];
  lastDbWrite: string | null;
}

/**
 * An observation safe to send to a remote policy. Structurally distinct from
 * Observation: the brand field means a raw Observation never type-checks
 * where a RedactedObservation is required, and visual is absent entirely.
 */
export interface RedactedObservation {
  readonly __redacted: true;
  native: RedactedNative;
  webview: RedactedWebview | null;
  signals: RedactedSignals;
}

/** JWT shape: three base64url segments, the first carrying a JOSE header. */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

/** Bearer credential shape. */
const BEARER_PATTERN = /[Bb][Ee][Aa][Rr][Ee][Rr]\s+[A-Za-z0-9._~+/-]+/g;

/** Key=value pairs whose key names a credential. Only the value is replaced. */
const SECRET_PAIR_PATTERN =
  /([\w.-]*(?:token|secret|password|passwd|apikey|api_?key|auth|session|cookie|bearer)[\w.-]*)(\s*=\s*)([^\s&;,'"]+)/gi;

/** Email address shape. */
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Phone shape: digit groups joined by separators, with an optional country prefix. */
const PHONE_PATTERN = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]){1,3}\d{3,4}/g;

/** Hex or base64 runs of 24 characters or more. */
const LONG_TOKEN_PATTERN = /(?:\b[0-9a-fA-F]{24,}\b|[A-Za-z0-9+/]{24,}={0,2})/g;

/** Digit runs of 13 or more, catching card numbers with or without separators. */
const LONG_DIGIT_PATTERN = /\d(?:[\s.-]?\d){12,}/g;

/**
 * Turns an Observation into the only payload a remote policy may receive.
 * Redaction is unconditional: there is no flag, option or environment
 * variable that disables any rule.
 */
export function redactObservation(observation: Observation): RedactedObservation {
  return {
    __redacted: true,
    native: redactNative(observation.native),
    webview: observation.webview === null ? null : redactWebview(observation.webview),
    signals: redactSignals(observation.signals),
  };
}

/**
 * Redacts the native layer, masking control text and content descriptions.
 */
function redactNative(native: NativeObservation): RedactedNative {
  return {
    controls: native.controls.map((control) => ({
      index: control.index,
      bounds: [...control.bounds] as Bounds,
      className: control.className,
      text: maskText(control.text),
      contentDesc: maskText(control.contentDesc),
      clickable: control.clickable,
      enabled: control.enabled,
    })),
    packageName: native.packageName,
    activity: native.activity,
    systemUi: { ...native.systemUi },
    webViewBounds:
      native.webViewBounds === undefined ? undefined : ([...native.webViewBounds] as Bounds),
  };
}

/**
 * Redacts the WebView layer. Input field values are dropped and replaced by
 * a shape hint recording the field type and value length; content is never
 * carried, because a policy must know a password field exists without ever
 * receiving its contents.
 */
function redactWebview(webview: WebviewObservation): RedactedWebview {
  return {
    elements: webview.elements.map((element) => ({
      index: element.index,
      cssSelector: element.cssSelector,
      role: element.role,
      text: element.isInput
        ? `<input:${element.inputType ?? "text"}, ${element.text.length} chars>`
        : maskText(element.text),
      enabled: element.enabled,
      visible: element.visible,
      bounds: [...element.bounds] as Bounds,
      isInput: element.isInput,
      inputType: element.inputType,
      clickable: element.clickable,
      name: maskText(element.name ?? ""),
    })),
  };
}

/**
 * Redacts session signals. Error messages are masked before truncation so a
 * secret can never ride along inside a long stack trace.
 */
function redactSignals(signals: SessionSignalState): RedactedSignals {
  return {
    pendingRequests: signals.pendingRequests,
    recentErrors: signals.recentErrors.map((entry) => truncateError(maskText(entry))),
    lastDbWrite: signals.lastDbWrite,
  };
}

/**
 * Masks every sensitive shape in a free-text run, preserving the kind of
 * what was present through a stable placeholder.
 */
function maskText(value: string): string {
  return value
    .replace(JWT_PATTERN, REDACTION_PLACEHOLDERS.jwt)
    .replace(BEARER_PATTERN, REDACTION_PLACEHOLDERS.bearer)
    .replace(
      SECRET_PAIR_PATTERN,
      (_match, key: string, separator: string) =>
        `${key}${separator}${REDACTION_PLACEHOLDERS.secret}`,
    )
    .replace(EMAIL_PATTERN, REDACTION_PLACEHOLDERS.email)
    .replace(PHONE_PATTERN, REDACTION_PLACEHOLDERS.phone)
    .replace(LONG_TOKEN_PATTERN, REDACTION_PLACEHOLDERS.token)
    .replace(LONG_DIGIT_PATTERN, REDACTION_PLACEHOLDERS.number);
}

/** Masks and bounds free text before it enters a remote-policy history payload. */
export function redactText(value: string): string {
  const masked = maskText(value).replace(/(["'])(?:(?!\1)[^\\\r\n])*\1/g, "$1<redacted>$1");
  return truncateError(masked);
}

/**
 * Bounds one error message after masking has already run.
 */
function truncateError(value: string): string {
  return value.length > REDACTED_ERROR_MAX_LENGTH
    ? value.slice(0, REDACTED_ERROR_MAX_LENGTH)
    : value;
}

/**
 * Masks a step decision before it is written to the run trace or returned
 * over MCP.
 *
 * `Decision.text` carries whatever a `type` step entered, and `detail` carries
 * the raw policy answer. Both land in the `.capu` archive and in
 * `automation_read_run_trace`, which an external reasoner reads — so a flow
 * that types a credential would otherwise persist it to disk and hand it to a
 * third party. The same rules as `redactObservation` apply, so a token, key,
 * JWT, email or card-shaped value is masked while ordinary text such as a
 * product name survives and stays useful for debugging.
 *
 * This masks patterns, not intent: an arbitrary human password is not
 * pattern-detectable. Marking a step's text as sensitive at authoring time is
 * the complementary control and is tracked separately.
 */
export function redactDecision<T extends { text?: string; detail?: unknown }>(decision: T): T {
  const masked: T = { ...decision };
  if (typeof masked.text === "string") {
    masked.text = redactText(masked.text);
  }
  if (masked.detail !== undefined) {
    masked.detail = redactDetail(masked.detail);
  }
  return masked;
}

/** Walks a raw policy answer, masking every string it holds at any depth. */
function redactDetail(detail: unknown): unknown {
  if (typeof detail === "string") {
    return redactText(detail);
  }
  if (Array.isArray(detail)) {
    return detail.map((entry) => redactDetail(entry));
  }
  if (typeof detail === "object" && detail !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(detail)) {
      out[key] = redactDetail(value);
    }
    return out;
  }
  return detail;
}
