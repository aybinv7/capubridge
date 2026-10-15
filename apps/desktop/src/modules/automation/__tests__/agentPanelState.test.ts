import { describe, expect, test } from "vite-plus/test";
import {
  appendFeedEntry,
  appendRunEntry,
  ARTEMIS_PARKED_REASON,
  cancelRunView,
  createRunView,
  DEFAULT_POLICY_ID,
  defaultLimitsFor,
  describePolicySelection,
  finishRunView,
  LOCAL_POLICY_STATEMENT,
  startRunView,
} from "../agentPanelState";
import type { FeedEntry, PolicyOption } from "../agentPanelState";
import { JEV_DATA_NOTICE } from "../policies/jev";

const RULES: PolicyOption = { id: "rules", label: "Rules", isRemote: false, dataNotice: null };
const JEV: PolicyOption = { id: "jev", label: "Jev", isRemote: true, dataNotice: JEV_DATA_NOTICE };

function entry(seq: number): FeedEntry {
  return { seq, stepId: `s${seq}`, operation: "tap", confidence: 1, outcome: "ok", detail: null };
}

describe("agent panel state", () => {
  test("the default policy is jev", () => {
    expect(DEFAULT_POLICY_ID).toBe("jev");
    expect(JEV.id).toBe(DEFAULT_POLICY_ID);
  });

  test("a remote policy surfaces its notice from the policy object", () => {
    const selection = describePolicySelection(JEV);
    expect(selection.runnable).toBe(true);
    expect(selection.remote).toBe(true);
    expect(selection.notice).toBe(JEV.dataNotice);
    expect(selection.notice).toBe(JEV_DATA_NOTICE);
  });

  test("a local policy surfaces the local statement", () => {
    const selection = describePolicySelection(RULES);
    expect(selection.runnable).toBe(true);
    expect(selection.remote).toBe(false);
    expect(selection.notice).toBe(LOCAL_POLICY_STATEMENT);
  });

  test("a parked policy cannot run and says why", () => {
    const selection = describePolicySelection({
      ...RULES,
      id: "artemis",
      label: "Artemis",
      unavailableReason: ARTEMIS_PARKED_REASON,
    });
    expect(selection.runnable).toBe(false);
    expect(selection.notice).toBe(ARTEMIS_PARKED_REASON);
  });

  test("parking beats the local statement, so a parked local policy still cannot run", () => {
    const parked = describePolicySelection({ ...RULES, unavailableReason: "paused for now" });
    expect(parked.runnable).toBe(false);
    expect(parked.notice).not.toBe(LOCAL_POLICY_STATEMENT);
  });

  test("an absent or empty reason leaves a policy runnable", () => {
    expect(describePolicySelection({ ...RULES, unavailableReason: null }).runnable).toBe(true);
    expect(describePolicySelection({ ...RULES, unavailableReason: "" }).runnable).toBe(true);
  });

  test("a remote policy with a null notice cannot run", () => {
    const selection = describePolicySelection({
      id: "jev",
      label: "Jev",
      isRemote: true,
      dataNotice: null,
    });
    expect(selection.runnable).toBe(false);
  });

  test("ARTEMIS default duration is materially larger than the Jev default", () => {
    const artemis = defaultLimitsFor("artemis");
    const jev = defaultLimitsFor("jev");
    expect(artemis.maxDurationMs).toBeGreaterThan(jev.maxDurationMs);
  });

  test("the feed appends in order and keeps ordering when results arrive out of order", () => {
    const feed = appendFeedEntry(
      appendFeedEntry(appendFeedEntry([], entry(2)), entry(0)),
      entry(1),
    );
    expect(feed.map((row) => row.seq)).toEqual([0, 1, 2]);
  });

  test("cancelling transitions the state and stops further appends", () => {
    const running = appendRunEntry(startRunView(), entry(0));
    const cancelled = cancelRunView(running);
    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.entries).toHaveLength(1);
    expect(appendRunEntry(cancelled, entry(1)).entries).toHaveLength(1);
  });

  test("a blocked decision surfaces its reason", () => {
    const blocked: FeedEntry = {
      seq: 3,
      stepId: "s3",
      operation: "blocked",
      confidence: 1,
      outcome: "blocked",
      detail: "target unresolvable after the settle budget",
    };
    const view = appendRunEntry(startRunView(), blocked);
    expect(view.entries[0]?.detail).toContain("settle budget");
    const finished = finishRunView(view, "halted", blocked.detail);
    expect(finished.state).toBe("halted");
    expect(finished.failureReason).toContain("settle budget");
  });

  test("an idle view creates cleanly", () => {
    expect(createRunView()).toEqual({ state: "idle", entries: [], failureReason: null });
  });
});
