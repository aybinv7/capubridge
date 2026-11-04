// @vitest-environment happy-dom
import { describe, expect, test, vi } from "vite-plus/test";
import { fuzzyScore, rankByScore } from "../fuzzy";
import { bindingLabel, bindingTokens, parseBinding } from "../keymap";
import { resolveKeydown, SEQUENCE_TIMEOUT_MS } from "../dispatch";
import type { Command } from "../types";

function key(init: KeyboardEventInit & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

function command(id: string, binding: string, extra: Partial<Command> = {}): Command {
  return { id, title: id, group: "View", binding, run: vi.fn(), ...extra };
}

describe("fuzzyScore", () => {
  test("contiguous matches beat scattered ones", () => {
    expect(fuzzyScore("net", "Go to Network")).toBeGreaterThan(fuzzyScore("net", "New target"));
  });

  test("word-start matches beat mid-word matches", () => {
    expect(fuzzyScore("dev", "Go to Device")).toBeGreaterThan(fuzzyScore("dev", "Undevelop"));
  });

  test("non-subsequences score zero", () => {
    expect(fuzzyScore("xyz", "Go to Network")).toBe(0);
  });

  test("subsequences across words still match", () => {
    expect(fuzzyScore("gtn", "Go to Network")).toBeGreaterThan(0);
  });

  test("rankByScore filters and orders, keeping input order on ties", () => {
    const ranked = rankByScore(
      ["Theme: Bench Dark", "Go to Network", "Show Logcat"],
      "net",
      (t) => t,
    );
    expect(ranked).toEqual(["Go to Network"]);
    expect(rankByScore(["b", "a"], "", (t) => t)).toEqual(["b", "a"]);
  });
});

describe("keymap", () => {
  test("parses chords and sequences", () => {
    expect(parseBinding("mod+shift+p")).toEqual({
      kind: "chord",
      chord: { mod: true, shift: true, alt: false, key: "p" },
    });
    expect(parseBinding("g d")).toEqual({ kind: "sequence", keys: ["g", "d"] });
  });

  test("turns bindings into Cladd shortcut tokens", () => {
    expect(bindingTokens("mod+k")).toBe("cmd k");
    expect(bindingTokens("mod+shift+d")).toBe("cmd shift d");
    expect(bindingTokens("g d")).toBe("g d");
    expect(bindingTokens("mod+,")).toBe("cmd ,");
    expect(bindingTokens("escape")).toBe("esc");
    expect(bindingTokens("mod+arrowup")).toBe("cmd up");
  });

  test("turns bindings into plain-text hints", () => {
    expect(bindingLabel("mod+j")).toBe("Ctrl+J");
    expect(bindingLabel("mod+shift+d")).toBe("Ctrl+Shift+D");
    expect(bindingLabel("g n")).toBe("G then N");
    expect(bindingLabel("escape")).toBe("Esc");
  });
});

describe("resolveKeydown", () => {
  const palette = command("palette", "mod+k", { global: true });
  const rail = command("rail", "mod+b");
  const network = command("network", "g n");
  const all = [palette, rail, network];

  test("chords match regardless of sequences", () => {
    expect(resolveKeydown(all, key({ key: "k", ctrlKey: true }), false, null, 0).command).toBe(
      palette,
    );
  });

  test("non-global chords are ignored while typing", () => {
    expect(resolveKeydown(all, key({ key: "b", ctrlKey: true }), true, null, 0).command).toBeNull();
    expect(resolveKeydown(all, key({ key: "k", ctrlKey: true }), true, null, 0).command).toBe(
      palette,
    );
  });

  test("a sequence completes within the timeout", () => {
    const first = resolveKeydown(all, key({ key: "g" }), false, null, 100);
    expect(first.command).toBeNull();
    expect(first.sequence).toEqual({ key: "g", at: 100 });
    const second = resolveKeydown(all, key({ key: "n" }), false, first.sequence, 400);
    expect(second.command).toBe(network);
  });

  test("an expired sequence does not complete", () => {
    const late = 100 + SEQUENCE_TIMEOUT_MS + 1;
    expect(
      resolveKeydown(all, key({ key: "n" }), false, { key: "g", at: 100 }, late).command,
    ).toBeNull();
  });

  test("sequences never fire while typing", () => {
    const result = resolveKeydown(all, key({ key: "g" }), true, null, 0);
    expect(result.sequence).toBeNull();
  });

  test("punctuation chords ignore the layout shift state (AZERTY period)", () => {
    const actions = command("actions", "mod+.");
    expect(
      resolveKeydown([actions], key({ key: ".", ctrlKey: true, shiftKey: true }), false, null, 0)
        .command,
    ).toBe(actions);
  });

  test("letter chords still require the exact shift state", () => {
    expect(
      resolveKeydown(all, key({ key: "b", ctrlKey: true, shiftKey: true }), false, null, 0).command,
    ).toBeNull();
  });

  test("commands hidden by `when` are not dispatched", () => {
    const hidden = command("hidden", "mod+j", { when: () => false });
    expect(
      resolveKeydown([hidden], key({ key: "j", ctrlKey: true }), false, null, 0).command,
    ).toBeNull();
  });
});
