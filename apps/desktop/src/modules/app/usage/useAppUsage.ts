import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useAdb } from "@/composables/useAdb";
import type { AppSubject } from "../subject/subject.types";
import { parseBatteryStats } from "./batterystats";
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
 * Both are read when a screen that shows them opens, never on a timer.
 */
export function useAppUsage(
  subject: Readonly<Ref<AppSubject | null>>,
  /** The app's uid from its package dump; `undefined` until the dump is read. */
  uid: Readonly<Ref<number | null | undefined>>,
) {
  const { shellCommand } = useAdb();
  const keys = computed(() => usageKeys(subject.value));

  const network = useQuery({
    queryKey: computed(() => [...keys.value.network, uid.value ?? -1]),
    queryFn: async ({ signal }) => {
      const current = subject.value;
      const appUid = uid.value ?? null;
      if (!current || appUid === null) return parseNetworkStats("", null);
      const output = await shellCommand(
        current.serial,
        "cat /proc/net/xt_qtaguid/stats 2>/dev/null",
        { signal },
      );
      return parseNetworkStats(output, appUid);
    },
    enabled: computed(() => subject.value !== null && uid.value !== undefined),
    staleTime: USAGE_STALE_MS,
  });

  const battery = useQuery({
    queryKey: computed(() => keys.value.battery),
    queryFn: async ({ signal }) => {
      const current = subject.value;
      if (!current) return parseBatteryStats("");
      const output = await shellCommand(
        current.serial,
        `dumpsys batterystats --charged ${current.packageName} 2>/dev/null | head -60`,
        { signal },
      );
      return parseBatteryStats(output);
    },
    enabled: computed(() => subject.value !== null),
    staleTime: USAGE_STALE_MS,
  });

  return { network, battery };
}
