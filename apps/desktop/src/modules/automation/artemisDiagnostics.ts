export function artemisDiagnosticMessage(report: unknown): string {
  if (typeof report !== "object" || report === null) return "ARTEMIS diagnostics are unavailable.";
  const value = report as {
    verdict?: unknown;
    next_steps?: unknown;
    overall_ready?: unknown;
    probes?: unknown;
  };
  const steps = Array.isArray(value.next_steps)
    ? value.next_steps.filter((step): step is string => typeof step === "string").slice(0, 3)
    : [];
  if (steps.length > 0) return steps.join(" ");
  const probeMessages = readinessProbeMessages(value.probes);
  if (probeMessages.length > 0) return probeMessages.join(" ");
  if (value.overall_ready === true)
    return "ARTEMIS daemon and device are ready. Inspect the task error for the failed launch.";
  if (steps.length === 0)
    return `ARTEMIS is ${typeof value.verdict === "string" ? value.verdict : "unavailable"}.`;
  return steps.join(" ");
}

function readinessProbeMessages(probes: unknown): string[] {
  if (!Array.isArray(probes)) return [];
  return probes
    .flatMap((probe) => {
      if (typeof probe !== "object" || probe === null) return [];
      const row = probe as { status?: unknown; description?: unknown; summary?: unknown };
      if (row.status !== "fail" && row.status !== "error") return [];
      if (typeof row.description === "string" && row.description !== "") return [row.description];
      if (typeof row.summary === "string" && row.summary !== "") return [row.summary];
      return [];
    })
    .slice(0, 3);
}
