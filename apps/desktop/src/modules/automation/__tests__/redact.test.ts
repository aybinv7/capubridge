import { describe, expect, test } from "vite-plus/test";
import type { IndexedElement, Observation } from "@/types/automation.types";
import { REDACTED_ERROR_MAX_LENGTH, REDACTION_PLACEHOLDERS, redactObservation } from "../redact";
import type { RedactedObservation } from "../redact";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxRJPs8MaX7mCIfaK3Yxhm5HkyB1ibNXx0k3mE";
const BEARER = "Bearer abcdef1234567890ABCDEF";
const HEX40 = "0123456789abcdef0123456789ABCDEF01234567";
const API_PAIR = "api_key=abcdef1234567890abcdef1234567890";
const EMAIL = "customer@example.com";
const CARD = "4111111111111111";
const PHONE = "+1-555-123-4567";

/** Builds an observation carrying the given secret in every text-bearing surface. */
function observationWithSecret(secret: string): Observation {
  return {
    native: {
      controls: [
        {
          index: 0,
          bounds: [0, 0, 100, 50],
          className: "android.widget.TextView",
          text: `native label ${secret}`,
          contentDesc: `desc ${secret}`,
          clickable: false,
          enabled: true,
        },
      ],
      packageName: "com.example.app",
      activity: "MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
    },
    webview: {
      elements: [
        {
          index: 0,
          cssSelector: ".note",
          role: "paragraph",
          text: `webview note ${secret}`,
          enabled: true,
          visible: true,
          bounds: [0, 0, 100, 50],
          isInput: false,
          inputType: null,
        },
      ],
    },
    signals: {
      pendingRequests: 0,
      recentErrors: [`boom ${secret}`],
      lastDbWrite: null,
    },
    visual: { screenshotRef: "runs/abc/shot-1.png" },
  };
}

describe("redactObservation", () => {
  test("a password input value is dropped and replaced by a length hint", () => {
    const observation = observationWithSecret("placeholder");
    const password: IndexedElement = {
      index: 7,
      cssSelector: "input[name=password]",
      role: "textbox",
      text: "hunter2correct",
      enabled: true,
      visible: true,
      bounds: [0, 0, 200, 40],
      isInput: true,
      inputType: "password",
    };
    observation.webview?.elements.push(password);
    const redacted = redactObservation(observation);
    const element = redacted.webview?.elements.find((entry) => entry.index === 7);
    expect(element?.text).not.toContain("hunter2");
    expect(element?.text).not.toContain("hunter2correct");
    expect(element?.text).toContain("14");
    expect(element?.text).toContain("password");
    expect(element?.isInput).toBe(true);
  });

  test("a JWT, bearer value, long hex run and api_key pair are each masked by kind", () => {
    const redacted = redactObservation(
      observationWithSecret(`${JWT} ${BEARER} ${HEX40} ${API_PAIR}`),
    );
    const body = JSON.stringify(redacted);
    expect(body).not.toContain(JWT);
    expect(body).not.toContain("abcdef1234567890ABCDEF");
    expect(body).not.toContain(HEX40);
    expect(body).not.toContain("abcdef1234567890abcdef1234567890");
    expect(body).toContain(REDACTION_PLACEHOLDERS.jwt);
    expect(body).toContain(REDACTION_PLACEHOLDERS.bearer);
    expect(body).toContain(REDACTION_PLACEHOLDERS.token);
    expect(body).toContain(REDACTION_PLACEHOLDERS.secret);
  });

  test("an email address and a card number in native text are masked", () => {
    const redacted = redactObservation(observationWithSecret(`${EMAIL} ${CARD}`));
    const body = JSON.stringify(redacted);
    expect(body).not.toContain(EMAIL);
    expect(body).not.toContain(CARD);
    expect(body).toContain(REDACTION_PLACEHOLDERS.email);
    expect(body).toContain(REDACTION_PLACEHOLDERS.number);
  });

  test("a phone-shaped string is masked", () => {
    const redacted = redactObservation(observationWithSecret(PHONE));
    const body = JSON.stringify(redacted);
    expect(body).not.toContain(PHONE);
    expect(body).toContain(REDACTION_PLACEHOLDERS.phone);
  });

  test("visual is absent from the result", () => {
    const redacted = redactObservation(observationWithSecret("nothing"));
    expect("visual" in redacted).toBe(false);
    expect(JSON.stringify(redacted)).not.toContain("shot-1.png");
  });

  test("recentErrors are masked before truncation, then bounded", () => {
    const padding = "lorem ipsum dolor ".repeat(200);
    const observation = observationWithSecret("nothing");
    observation.signals.recentErrors = [`${API_PAIR} ${padding}`];
    const redacted = redactObservation(observation);
    const entry = redacted.signals.recentErrors[0] ?? "";
    expect(entry).not.toContain("abcdef1234567890abcdef1234567890");
    expect(entry.length).toBeLessThanOrEqual(REDACTED_ERROR_MAX_LENGTH);
  });

  test("substring sweep: no known secret survives in any payload surface", () => {
    const secrets = [
      JWT,
      BEARER,
      HEX40,
      API_PAIR,
      "session=super-secret-session-value",
      "Authorization: Bearer leak-value-1234567890",
      EMAIL,
      CARD,
      PHONE,
      "password=hunter2correct",
    ];
    for (const secret of secrets) {
      const body = JSON.stringify(redactObservation(observationWithSecret(secret)));
      expect(body).not.toContain(secret);
    }
  });

  test("redaction is idempotent", () => {
    const once = redactObservation(observationWithSecret(`${EMAIL} ${JWT} ${CARD}`));
    const twice = redactObservation({
      native: {
        controls: once.native.controls.map((control) => ({ ...control })),
        packageName: once.native.packageName,
        activity: once.native.activity,
        systemUi: { ...once.native.systemUi },
      },
      webview:
        once.webview === null
          ? null
          : { elements: once.webview.elements.map((element) => ({ ...element })) },
      signals: {
        pendingRequests: once.signals.pendingRequests,
        recentErrors: [...once.signals.recentErrors],
        lastDbWrite: once.signals.lastDbWrite,
      },
      visual: { screenshotRef: "" },
    });
    expect(twice).toEqual({ ...once });
  });

  test("non-sensitive text survives unchanged", () => {
    const redacted = redactObservation(observationWithSecret("Add to cart"));
    const body = JSON.stringify(redacted);
    expect(body).toContain("Add to cart");
    expect(body).toContain("MainActivity");
  });

  test("a raw Observation does not satisfy RedactedObservation", () => {
    const raw = observationWithSecret("nothing");
    const redacted: RedactedObservation = redactObservation(raw);
    expect(redacted.__redacted).toBe(true);
    // @ts-expect-error a raw observation must never type-check as a redacted payload
    const rejected: RedactedObservation = raw;
    expect(rejected).toBeDefined();
  });
});

describe("accessible names cross the redaction gate masked, never dropped", () => {
  test("an element's accessible name reaches the redacted layer", () => {
    const observation = observationWithSecret("nothing");
    const element = observation.webview?.elements[0];
    if (element === undefined) {
      throw new Error("fixture must carry a webview element");
    }
    element.name = "search";
    const redacted = redactObservation(observation);
    expect(redacted.webview?.elements[0]?.name).toBe("search");
  });

  test("a secret inside an accessible name is masked like visible text", () => {
    const observation = observationWithSecret("nothing");
    const element = observation.webview?.elements[0];
    if (element === undefined) {
      throw new Error("fixture must carry a webview element");
    }
    element.name = `Contact ${EMAIL}`;
    const redacted = redactObservation(observation);
    expect(redacted.webview?.elements[0]?.name).not.toContain(EMAIL);
    expect(redacted.webview?.elements[0]?.name).toContain(REDACTION_PLACEHOLDERS.email);
  });
});
