import type { AutomationCandidate, Observation } from "@/types/automation.types";

export function candidatesFromObservation(observation: Observation): AutomationCandidate[] {
  const candidates: AutomationCandidate[] = [];
  const seen = new Set<string>();
  const seenLabels = new Set<string>();
  for (const element of observation.webview?.elements ?? []) {
    if (!element.visible || !element.enabled || element.cssSelector === "") {
      continue;
    }
    const target = { kind: "selector" as const, cssSelector: element.cssSelector };
    const candidate: AutomationCandidate = {
      id: `webview-${element.index}`,
      label: element.text === "" ? `${element.role} · ${element.cssSelector}` : element.text,
      source: "webview",
      target,
      enabled: element.enabled,
    };
    const key = `${target.kind}:${target.cssSelector}`;
    if (!seen.has(key)) {
      seen.add(key);
      if (element.text.trim() !== "") {
        seenLabels.add(element.text.trim().toLowerCase());
      }
      candidates.push(candidate);
    }
  }
  for (const control of observation.native.controls) {
    if (!control.enabled || control.bounds[2] <= 0 || control.bounds[3] <= 0) {
      continue;
    }
    const text = control.text.trim() || control.contentDesc.trim();
    if (text !== "" && seenLabels.has(text.toLowerCase())) {
      continue;
    }
    const target =
      text === ""
        ? { kind: "nativeIndex" as const, index: control.index }
        : { kind: "text" as const, text, exact: true };
    const candidate: AutomationCandidate = {
      id: `native-${control.index}`,
      label: text === "" ? `${control.className} · #${control.index}` : text,
      source: "native",
      target,
      enabled: control.enabled,
    };
    const key = `${target.kind}:${target.kind === "text" ? target.text : target.index}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(candidate);
    }
  }
  return candidates.slice(0, 80);
}
