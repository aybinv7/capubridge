import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useAdb } from "@/composables/useAdb";
import type { AppSubject } from "../subject/subject.types";
import { appUid, type AppIdentity } from "./appIdentity";
import { batteryStatsCommand, batteryUidTag, parseBatteryStats } from "./batterystats";
import { parseNetworkStats } from "./netstats";

const USAGE_STALE_MS = 30_000;

/** Query keys of the usage counters, so a data wipe can drop them. */
export function usageKeys(subject: AppSubject | null) {
  const base = [subject?.serial ?? "", subject?.packageName ?? ""];
  return {
    network: ["app-usage-network", ...base] as const,
    battery: ["app-usage-battery", ...base] as const,
  };
}

/**
 * The app's traffic since the phone started and its battery use since the last full charge.
 * Both are read when a screen that shows them opens, never on a timer. Readings run beside the
 * phone's command queue; neither waits for anything but the app's identity.
 */
export function useAppUsage(
  subject: Readonly<Ref<AppSubject | null>>,
  /** `undefined` while the app's details are being read, `null` when they name no app id. */
  identity: Readonly<Ref<AppIdentity | null | undefined>>,
) {
  const { readShell } = useAdb();
  const keys = computed(() => usageKeys(subject.value));
  const uid = computed(() => (identity.value ? appUid(identity.value) : null));
  const tag = computed(() =>
    identity.value ? batteryUidTag(identity.value.user, identity.value.appId) : null,
  );
  const ready = computed(() => subject.value !== null && identity.value !== undefined);

  const network = useQuery({
    queryKey: computed(() => [...keys.value.network, uid.value ?? -1]),
    queryFn: async () => {
      const current = subject.value;
      const appUidValue = uid.value;
      if (!current || appUidValue === null) return parseNetworkStats("", null);
      const output = await readShell(current.serial, "cat /proc/net/xt_qtaguid/stats 2>/dev/null");
      return parseNetworkStats(output, appUidValue);
    },
    enabled: ready,
    staleTime: USAGE_STALE_MS,
  });

  const battery = useQuery({
    queryKey: computed(() => [...keys.value.battery, tag.value ?? ""]),
    queryFn: async () => {
      const current = subject.value;
      const uidTag = tag.value;
      if (!current || !uidTag) return parseBatteryStats("", null);
      const output = await readShell(
        current.serial,
        batteryStatsCommand(current.packageName, uidTag),
      );
      return parseBatteryStats(output, uidTag);
    },
    enabled: ready,
    staleTime: USAGE_STALE_MS,
  });

  return { network, battery, uid };
}
