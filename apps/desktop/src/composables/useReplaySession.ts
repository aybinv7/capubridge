import { invoke } from "@tauri-apps/api/core";
import { ref } from "vue";
import type {
  SessionManifest,
  NetworkCapuEvent,
  ConsoleCapuEvent,
  RrwebCapuEvent,
} from "@/types/replay.types";

export interface LoadedSession {
  manifest: SessionManifest;
  rrwebEvents: RrwebCapuEvent[];
  networkEvents: NetworkCapuEvent[];
  consoleEvents: ConsoleCapuEvent[];
}

export function useReplaySession() {
  const session = ref<LoadedSession | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

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
      const raw = await invoke<{ manifest_json: string; tracks: Record<string, string> }>(
        "recording_read_session",
        { filePath },
      );

      const manifest = JSON.parse(raw.manifest_json) as SessionManifest;

      const rrwebEvents = raw.tracks["rrweb"]
        ? parseNdjson<RrwebCapuEvent>(raw.tracks["rrweb"])
        : [];
      const networkEvents = raw.tracks["network"]
        ? parseNdjson<NetworkCapuEvent>(raw.tracks["network"])
        : [];
      const consoleEvents = raw.tracks["console"]
        ? parseNdjson<ConsoleCapuEvent>(raw.tracks["console"])
        : [];

      session.value = { manifest, rrwebEvents, networkEvents, consoleEvents };
    } catch (err) {
      error.value = String(err);
    } finally {
      isLoading.value = false;
    }
  }

  return { session, isLoading, error, load };
}
