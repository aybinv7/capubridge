import type { ChainLink, GateInput, GateRequirement } from "@/lib/gates/types";

function adbLink(input: GateInput): ChainLink {
  switch (input.adb) {
    case "running":
      return { key: "adb", label: "ADB", value: "running", state: "ok" };
    case "starting":
      return { key: "adb", label: "ADB", value: "starting", state: "pending" };
    case "error":
      return { key: "adb", label: "ADB", value: "not running", state: "broken" };
    case "unknown":
      return { key: "adb", label: "ADB", value: "checking", state: "pending" };
  }
}

function hostLink(input: GateInput): ChainLink {
  const source = input.target?.source;
  if (source === "local") return { key: "host", label: "Host", value: "This PC", state: "ok" };
  if (source === "chrome") return { key: "host", label: "Host", value: "Chrome", state: "ok" };
  const device = input.device;
  if (!device) return { key: "host", label: "Device", value: "none", state: "broken" };
  const name = device.name || device.model || device.serial;
  if (device.status === "unauthorized" || device.status === "no-permissions") {
    return { key: "host", label: "Device", value: `${name} · ${device.status}`, state: "broken" };
  }
  if (device.status !== "online" || device.isStale) {
    return { key: "host", label: "Device", value: `${name} · offline`, state: "broken" };
  }
  return { key: "host", label: "Device", value: name, state: "ok" };
}

function targetLink(input: GateInput, requirement: GateRequirement): ChainLink {
  const target = input.target;
  if (!target) return { key: "target", label: "Target", value: "none", state: "broken" };
  if (requirement === "app-target" && (target.source !== "adb" || !target.packageName)) {
    return { key: "target", label: "App", value: target.title, state: "broken" };
  }
  if (target.source === "adb" && input.presence === "gone") {
    return { key: "target", label: "Target", value: `${target.title} · gone`, state: "broken" };
  }
  const label = requirement === "app-target" ? "App" : "Target";
  const value = requirement === "app-target" ? (target.packageName ?? target.title) : target.title;
  return { key: "target", label, value, state: "ok" };
}

function devtoolsLink(input: GateInput): ChainLink {
  switch (input.link) {
    case "connected":
      return { key: "link", label: "DevTools", value: "live", state: "ok" };
    case "connecting":
      return { key: "link", label: "DevTools", value: "attaching", state: "pending" };
    case "disconnected":
      return { key: "link", label: "DevTools", value: "closed", state: "broken" };
    case "error":
      return { key: "link", label: "DevTools", value: "failed", state: "broken" };
    case "idle":
    case "none":
      return { key: "link", label: "DevTools", value: "not attached", state: "idle" };
  }
}

/**
 * The hops a requirement depends on, in order. Hops after the first broken one are
 * reported as `idle` so the eye lands on the real break, not on its consequences.
 */
export function buildChain(requirement: GateRequirement, input: GateInput): ChainLink[] {
  if (requirement === "none") return [];
  const remote = !input.target || input.target.source === "adb";
  const links: ChainLink[] = [];
  if (remote || requirement === "device") links.push(adbLink(input));
  if (requirement === "device") {
    links.push(hostLink({ ...input, target: null }));
    return settle(links);
  }
  links.push(hostLink(input));
  links.push(targetLink(input, requirement));
  if (requirement === "target") links.push(devtoolsLink(input));
  return settle(links);
}

function settle(links: ChainLink[]): ChainLink[] {
  const breakAt = links.findIndex((link) => link.state === "broken" || link.state === "pending");
  if (breakAt < 0) return links;
  return links.map((link, index) =>
    index > breakAt && link.state !== "ok" ? { ...link, state: "idle" } : link,
  );
}
