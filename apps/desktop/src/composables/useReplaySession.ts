import { ref } from "vue";
import { invokeCommand } from "@/runtime/ipc/client";
import type {
  SessionManifest,
  NetworkCapuEvent,
  ConsoleCapuEvent,
  RrwebCapuEvent,
  PerfCapuEvent,
  DatabaseCapuEvent,
} from "@/types/replay.types";

export interface LoadedSession {
  manifest: SessionManifest;
  rrwebEvents: RrwebCapuEvent[];
  networkEvents: NetworkCapuEvent[];
  consoleEvents: ConsoleCapuEvent[];
  perfEvents: PerfCapuEvent[];
  databaseEvents: DatabaseCapuEvent[];
  databasePath: string | null;
}

// Module-level singletons — survive route navigation
const session = ref<LoadedSession | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function parseReplayManifest(raw: string): SessionManifest {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (cause) {
    throw new Error("Corrupt replay manifest JSON: " + String(cause));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Corrupt replay manifest: expected an object");
  }
  const manifest = value as Partial<SessionManifest>;
  if (
    manifest.version !== 1 ||
    typeof manifest.sessionId !== "string" ||
    !manifest.sessionId ||
    typeof manifest.label !== "string" ||
    !Number.isFinite(manifest.startedAt) ||
    !Number.isFinite(manifest.duration) ||
    (manifest.duration ?? -1) < 0 ||
    !manifest.tracks ||
    typeof manifest.tracks !== "object"
  ) {
    throw new Error("Corrupt replay manifest: required fields are invalid");
  }
  return manifest as SessionManifest;
}

export function parseReplayNdjson<T>(track: string, ndjson: string): T[] {
  const events: T[] = [];
  const lines = ndjson.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (cause) {
      throw new Error(
        "Corrupt " + track + " track at line " + String(index + 1) + ": " + String(cause),
      );
    }
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !Number.isFinite((value as { t?: unknown }).t) ||
      !Object.prototype.hasOwnProperty.call(value, "data")
    ) {
      throw new Error(
        "Corrupt " + track + " track at line " + String(index + 1) + ": invalid event envelope",
      );
    }
    events.push(value as T);
  }
  return events;
}

export function useReplaySession() {
  async function load(filePath: string): Promise<void> {
    isLoading.value = true;
    error.value = null;
    session.value = null;

    try {
      const raw = await invokeCommand("recording_read_session", { filePath });

      const manifest = parseReplayManifest(raw.manifest_json);
      console.log("[replay] manifest:", manifest);
      console.log("[replay] available tracks:", Object.keys(raw.tracks));

      const rrwebEvents = raw.tracks["rrweb"]
        ? parseReplayNdjson<RrwebCapuEvent>("rrweb", raw.tracks["rrweb"])
        : [];
      const networkEvents = raw.tracks["network"]
        ? parseReplayNdjson<NetworkCapuEvent>("network", raw.tracks["network"])
        : [];
      const consoleEvents = raw.tracks["console"]
        ? parseReplayNdjson<ConsoleCapuEvent>("console", raw.tracks["console"])
        : [];
      const perfEvents = raw.tracks["perf"]
        ? parseReplayNdjson<PerfCapuEvent>("perf", raw.tracks["perf"])
        : [];
      const databaseEvents = raw.tracks["databases"]
        ? parseReplayNdjson<DatabaseCapuEvent>("databases", raw.tracks["databases"])
        : [];

      console.log("[replay] rrweb:", rrwebEvents.length, "events");
      console.log("[replay] network:", networkEvents.length, "events");
      console.log("[replay] console:", consoleEvents.length, "events");
      console.log("[replay] perf:", perfEvents.length, "events");
      if (perfEvents.length > 0) {
        console.log("[replay] perf[0]:", perfEvents[0]);
        console.log("[replay] perf[-1]:", perfEvents.at(-1));
      } else {
        console.warn(
          "[replay] perf track empty — raw track present?",
          "perf" in raw.tracks,
          "raw length:",
          raw.tracks["perf"]?.length ?? 0,
        );
      }

      session.value = {
        manifest,
        rrwebEvents,
        networkEvents,
        consoleEvents,
        perfEvents,
        databaseEvents,
        databasePath: raw.database_path ?? null,
      };
    } catch (err) {
      error.value = String(err);
      console.error("[replay] load failed:", err);
    } finally {
      isLoading.value = false;
    }
  }

  return { session, isLoading, error, load };
}
