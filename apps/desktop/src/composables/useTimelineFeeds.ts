import { onScopeDispose, watch } from "vue";
import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { useConsoleStore } from "@/stores/console.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { useRecordingStore } from "@/stores/recording.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useTimelineStore } from "@/stores/timeline.store";
import {
  consoleMarkers,
  exceptionMarker,
  logcatMarkers,
  networkActivityMarkers,
} from "@/lib/timeline/markerMappers";
import type { NetworkEntry } from "@/types/network.types";
import type { TimelineMarkerInput } from "@/types/timeline.types";

/**
 * Feeds the timeline from the evidence stores through their subscribe APIs: logcat, console,
 * exceptions and network become markers on one host clock, and target switches, navigations
 * and recordings become overlays. Mount once, in the main window.
 */
export function useTimelineFeeds() {
  const timeline = useTimelineStore();
  const logcatStore = useLogcatStore();
  const consoleStore = useConsoleStore();
  const networkStore = useNetworkStore();
  const targetsStore = useTargetsStore();
  const recordingStore = useRecordingStore();

  function targetSerial(): string | null {
    const target = targetsStore.selectedTarget;
    return target?.source === "adb" ? (target.deviceSerial ?? null) : null;
  }

  function finishedWallMs(entry: NetworkEntry): number {
    return entry.finishedTimestamp === null
      ? entry.startedAt
      : entry.startedAt + (entry.finishedTimestamp - entry.startTimestamp) * 1000;
  }

  watch(
    () => [logcatStore.serial, logcatStore.clock] as const,
    ([serial, clock]) => {
      if (serial) timeline.setClockOffset(serial, clock);
    },
    { immediate: true },
  );

  const unsubscribers = [
    logcatStore.feed.subscribe((change) => {
      if (change.kind !== "append") return;
      const markers: TimelineMarkerInput[] = [];
      for (const entry of change.items) {
        markers.push(...logcatMarkers(entry, timeline.toHostMs(entry.serial, entry.tsMs)));
      }
      timeline.pushMany(markers);
    }),
    consoleStore.consoleSource.feed.subscribe((change) => {
      if (change.kind !== "append") return;
      const serial = targetSerial();
      const markers: TimelineMarkerInput[] = [];
      for (const entry of change.items) {
        markers.push(...consoleMarkers(entry, timeline.toHostMs(serial, entry.timestamp)));
      }
      timeline.pushMany(markers);
    }),
    consoleStore.exceptionSource.feed.subscribe((change) => {
      if (change.kind !== "append") return;
      const serial = targetSerial();
      timeline.pushMany(
        change.items.map((entry) =>
          exceptionMarker(entry, timeline.toHostMs(serial, entry.timestamp)),
        ),
      );
    }),
    networkStore.activity.subscribe((activity) => {
      const serial = targetSerial();
      if (activity.kind === "navigation") {
        timeline.addHairline("navigation", activity.at, activity.url, {
          kind: "navigation",
          id: activity.url,
        });
        return;
      }
      const deviceMs =
        activity.kind === "failed" ? finishedWallMs(activity.entry) : activity.entry.startedAt;
      timeline.pushMany(
        networkActivityMarkers(activity.kind, activity.entry, timeline.toHostMs(serial, deviceMs)),
      );
    }),
  ];

  watch(
    () => targetsStore.selectedTarget?.id ?? null,
    (targetId, previous) => {
      if (targetId === previous) return;
      const target = targetsStore.selectedTarget;
      timeline.addHairline(
        "target",
        Date.now(),
        target ? (target.packageName ?? target.title) : "No target",
        targetId ? { kind: "target", id: targetId } : null,
      );
    },
  );

  let recordingRange: string | null = null;
  watch(
    () => recordingStore.isRecording,
    (recording) => {
      if (recording && !recordingRange) {
        const sessionId = recordingStore.sessionId ?? "recording";
        recordingRange = timeline.beginRange(
          "recording",
          recordingStore.startedAt ?? Date.now(),
          "Recording",
          { kind: "recording", id: sessionId },
        );
        return;
      }
      if (!recording && recordingRange) {
        timeline.endRange(recordingRange, Date.now());
        recordingRange = null;
      }
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  });
}
