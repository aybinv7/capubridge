import { computed, watch, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useAdb } from "@/composables/useAdb";
import type { AppSubject } from "../subject/subject.types";
import type { InspectedApp } from "../subject/useInspectedApp";
import { appIdFromDump, detectCapacitor, packageFlags } from "./capacitor";
import { parsePermissions } from "./permissions";

const DUMP_STALE_MS = 30_000;

/** Query key of the app's `dumpsys package` output, shared by every reader of it. */
export function packageDumpKey(subject: AppSubject | null): readonly unknown[] {
  return ["app-package-dump", subject?.serial ?? "", subject?.packageName ?? ""];
}

/**
 * The app's `dumpsys package` output, shared by its permissions, its Capacitor guess, its id and
 * flags. The package details already carry it, so it is read on its own only to refresh the
 * permissions after a change, or when the details came without it.
 */
export function usePackageDump(
  subject: Readonly<Ref<AppSubject | null>>,
  details: InspectedApp["details"],
) {
  const { readShell } = useAdb();
  const queryClient = useQueryClient();

  watch(
    () => details.data.value,
    (data) => {
      const current = subject.value;
      if (!current || data?.packageName !== current.packageName || !data.packageDump) return;
      queryClient.setQueryData(packageDumpKey(current), data.packageDump, {
        updatedAt: details.dataUpdatedAt.value,
      });
    },
    { immediate: true, flush: "sync" },
  );

  const query = useQuery({
    queryKey: computed(() => packageDumpKey(subject.value)),
    queryFn: () => {
      const current = subject.value;
      if (!current) return "";
      return readShell(current.serial, `dumpsys package ${current.packageName}`);
    },
    enabled: computed(() => subject.value !== null && !details.isPending.value),
    staleTime: DUMP_STALE_MS,
  });

  const user = computed(() => details.data.value?.userId ?? 0);
  const permissions = computed(() =>
    query.data.value ? parsePermissions(query.data.value, user.value) : null,
  );
  const capacitor = computed(() => (query.data.value ? detectCapacitor(query.data.value) : null));
  const flags = computed(() =>
    query.data.value ? packageFlags(query.data.value, user.value) : null,
  );
  const appId = computed(() => {
    const fromDetails = details.data.value?.appId;
    if (typeof fromDetails === "number") return fromDetails;
    return query.data.value ? appIdFromDump(query.data.value) : null;
  });

  return { query, permissions, capacitor, flags, appId, user };
}
