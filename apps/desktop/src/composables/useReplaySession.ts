import { invoke } from "@tauri-apps/api/core";
import { ref } from "vue";
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

export function useReplaySession() {
  function parseNdjson<T>(ndjson: string): T[] {
    return ndjson
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }

  async function load(filePath: string): Promise<void> {
    isLoading.value = true;
    error.value = null;
    session.value = null;

    try {
      const raw = await invoke<{
        manifest_json: string;
        tracks: Record<string, string>;
        database_path?: string | null;
      }>("recording_read_session", { filePath });

      const manifest = JSON.parse(raw.manifest_json) as SessionManifest;
      console.log("[replay] manifest:", manifest);
      console.log("[replay] available tracks:", Object.keys(raw.tracks));

      const rrwebEvents = raw.tracks["rrweb"]
        ? parseNdjson<RrwebCapuEvent>(raw.tracks["rrweb"])
        : [];
      const networkEvents = raw.tracks["network"]
        ? parseNdjson<NetworkCapuEvent>(raw.tracks["network"])
        : [];
      const consoleEvents = raw.tracks["console"]
        ? parseNdjson<ConsoleCapuEvent>(raw.tracks["console"])
        : [];
      const perfEvents = raw.tracks["perf"] ? parseNdjson<PerfCapuEvent>(raw.tracks["perf"]) : [];
      const databaseEvents = raw.tracks["databases"]
        ? parseNdjson<DatabaseCapuEvent>(raw.tracks["databases"])
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
