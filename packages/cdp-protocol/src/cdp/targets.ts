export interface RawCDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  devtoolsFrontendUrl?: string;
  webSocketDebuggerUrl: string;
  faviconUrl?: string;
}

/**
 * Fetch the list of inspectable targets from a local CDP HTTP endpoint.
 * Works for both local Chrome tabs and adb-forwarded Android targets.
 */
export async function fetchLocalTargets(port = 9222): Promise<RawCDPTarget[]> {
  const res = await fetch(`http://localhost:${port}/json`);
  if (!res.ok) throw new Error(`CDP /json returned ${res.status}`);
  return res.json() as Promise<RawCDPTarget[]>;
}
