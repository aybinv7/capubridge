import { describe, expect, test, vi } from "vite-plus/test";
import type { JsonValue } from "@/runtime/ipc/contracts/common";
import type { Observation } from "@/types/automation.types";
import { buildCandidates } from "../elementIndex";
import type { DecisionWireRequest } from "../decisions/decisionTypes";
import type { ImageTokenCalibration } from "../decisions/imageCalibration";
import type { ScreenEncoder } from "../decisions/screenImage";
import { createJevPolicy } from "../policies/jev";
import { VISUAL_BOX_QUESTION, VISUAL_PRESENT_QUESTION } from "../policies/jevVisual";
import { PolicyDecisionError } from "../policies/types";
import type { RemotePolicyInput } from "../policies/types";
import { redactObservation } from "../redact";

vi.mock("@/runtime/ipc/client", () => ({ invokeCommand: vi.fn() }));

const CALIBRATION: Record<string, ImageTokenCalibration> = {
  "typesafe/jev-1.14": {
    textTokensPerChar: 0.25,
    imageTokensBase: 100,
    imageTokensPerMegapixel: 1_000,
    measuredOn: "2026-11-06",
  },
};

const encodeScreen: ScreenEncoder = (_png, _support, slot) =>
  Promise.resolve({
    image: { slot, format: "jpeg", base64: "AAAA", width: 706, height: 1568 },
    deviceWidth: 1080,
    deviceHeight: 2400,
  });

function nativeDialog(withWebview: boolean): Observation {
  return {
    native: {
      controls: [],
      packageName: "com.example.demo",
      activity: "PermissionActivity",
      systemUi: { keyboardVisible: false, dialogPresent: true },
    },
    webview: withWebview
      ? {
          elements: [
            {
              index: 0,
              cssSelector: "#allow",
              role: "button",
              text: "Allow",
              enabled: true,
              visible: true,
              bounds: [10, 20, 100, 40],
              isInput: false,
              inputType: null,
            },
          ],
        }
      : null,
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

function input(withWebview: boolean, readScreen = vi.fn(() => Promise.resolve("iVBORw0K"))) {
  const observation = nativeDialog(withWebview);
  const remote: RemotePolicyInput = {
    goal: "allow notifications",
    observation: redactObservation(observation),
    candidates: buildCandidates(observation),
    history: [],
    stepIndex: 0,
    readScreen,
  };
  return { remote, readScreen };
}

function scripted(presence: number, inputTokens = 1_600) {
  const sent: DecisionWireRequest[] = [];
  const response: JsonValue = {
    model: "typesafe/jev-1.14-20261014",
    answers: {
      operation: { type: "choice", choice: "tap", confidence: 0.9 },
      screen_ready: { type: "noul", noul: 0.95 },
      goal_reached: { type: "noul", noul: 0.05 },
      [VISUAL_PRESENT_QUESTION]: { type: "noul", noul: presence },
      [VISUAL_BOX_QUESTION]: {
        type: "box",
        box: { top: 0.48, bottom: 0.54, left: 0.14, right: 0.86 },
        confidence: 0.7,
      },
    },
    usage: { input_tokens: inputTokens, output_tokens: 0, cost: 0.00007 },
  };
  return {
    sent,
    transport: {
      send: (request: DecisionWireRequest) => {
        sent.push(request);
        return Promise.resolve(response);
      },
    },
  };
}

describe("jev visual path on screens with no DOM", () => {
  test("presence past the threshold turns the box centre into a device tap", async () => {
    const { remote } = input(false);
    const { transport, sent } = scripted(0.93);
    const policy = createJevPolicy({
      model: "typesafe/jev-1.14",
      transport,
      encodeScreen,
      calibration: CALIBRATION,
    });

    const decision = await policy.decide(remote);

    expect(decision.target).toEqual({ kind: "point", x: 540, y: 1224 });
    expect(decision.reason).toContain("visual target (presence 0.93");
    expect(sent.at(0)?.dangerZone).toEqual(["images"]);
    expect(Object.keys(sent.at(0)?.body["questions"] as Record<string, JsonValue>)).toContain(
      VISUAL_BOX_QUESTION,
    );
  });

  test("presence under the threshold is never tapped", async () => {
    const { remote } = input(false);
    const { transport } = scripted(0.41);
    const policy = createJevPolicy({
      model: "typesafe/jev-1.14",
      transport,
      encodeScreen,
      calibration: CALIBRATION,
    });

    const failure = await policy.decide(remote).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect((failure as PolicyDecisionError).failure).toBe("rejected-target");
    expect((failure as PolicyDecisionError).message).toContain("below 0.8");
  });

  test("an image the gateway dropped fails closed before any action", async () => {
    const { remote } = input(false);
    const { transport } = scripted(0.99, 140);
    const policy = createJevPolicy({
      model: "typesafe/jev-1.14",
      transport,
      encodeScreen,
      calibration: CALIBRATION,
    });

    const failure = await policy.decide(remote).catch((error: unknown) => error);

    expect((failure as PolicyDecisionError).failure).toBe("unverified");
  });

  test("a screen with a DOM never captures or sends the screen", async () => {
    const { remote, readScreen } = input(true);
    const { transport, sent } = scripted(0.93);
    const policy = createJevPolicy({
      model: "typesafe/jev-1.14",
      transport,
      encodeScreen,
      calibration: CALIBRATION,
    });

    await policy.decide(remote).catch((error: unknown) => error);

    expect(readScreen).not.toHaveBeenCalled();
    expect(sent.at(0)?.body["assets"]).toBeUndefined();
  });

  test("an unmeasured model keeps the screenshot on the machine and says why", async () => {
    const { remote, readScreen } = input(false);
    const { transport, sent } = scripted(0.93);
    const policy = createJevPolicy({
      model: "typesafe/jev-1.14",
      transport,
      encodeScreen,
      calibration: {},
    });

    const failure = await policy.decide(remote).catch((error: unknown) => error);

    expect(readScreen).not.toHaveBeenCalled();
    expect(sent.at(0)?.body["assets"]).toBeUndefined();
    expect((failure as PolicyDecisionError).failure).toBe("malformed");
  });

  test("a model without box runs the text path on the same screen", async () => {
    const { remote, readScreen } = input(false);
    const { transport, sent } = scripted(0.93);
    const policy = createJevPolicy({
      model: "typesafe/jev-1.13",
      transport,
      encodeScreen,
      calibration: CALIBRATION,
    });

    await policy.decide(remote).catch((error: unknown) => error);

    expect(readScreen).not.toHaveBeenCalled();
    expect(sent.at(0)?.body["model"]).toBe("typesafe/jev-1.13-20260917");
  });
});
