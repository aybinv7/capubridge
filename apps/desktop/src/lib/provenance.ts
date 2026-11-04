/** Where a value on screen came from (study P2: one truth per value). */
export type Provenance = "live" | "cached" | "recorded" | "imported" | "local" | "stale";

export interface ProvenanceMeta {
  label: string;
  description: string;
  utility: string;
}

export const PROVENANCE: Record<Provenance, ProvenanceMeta> = {
  live: { label: "live", description: "Read from the device just now", utility: "" },
  cached: {
    label: "cached",
    description: "Last value read from the device; it may have changed since",
    utility: "prov-cached",
  },
  recorded: {
    label: "recorded",
    description: "Captured in a recording; not the device's current state",
    utility: "prov-recorded",
  },
  imported: {
    label: "imported",
    description: "Loaded from a file you imported; not connected to a device",
    utility: "prov-imported",
  },
  local: {
    label: "local copy",
    description: "A copy on this computer; edits do not reach the device",
    utility: "prov-local",
  },
  stale: {
    label: "stale",
    description: "The link to the device dropped; values are the last ones read",
    utility: "prov-stale",
  },
};
