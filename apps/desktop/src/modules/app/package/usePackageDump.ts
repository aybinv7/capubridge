import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useAdb } from "@/composables/useAdb";
import type { AppSubject } from "../subject/subject.types";
import { detectCapacitor, uidFromDump } from "./capacitor";
import { parsePermissions } from "./permissions";

const DUMP_STALE_MS = 30_000;

/** Query key of the app's `dumpsys package` output, shared by every reader of it. */
export function packageDumpKey(subject: AppSubject | null): readonly unknown[] {
  return ["app-package-dump", subject?.serial ?? "", subject?.packageName ?? ""];
}

/**
 * The app's `dumpsys package` output, read once and shared by its permissions, its Capacitor
 * guess and its uid. Reading it again (`refetch`) refreshes all three.
 */
export function usePackageDump(subject: Readonly<Ref<AppSubject | null>>) {
  const { shellCommand } = useAdb();
  const query = useQuery({
    queryKey: computed(() => packageDumpKey(subject.value)),
    queryFn: ({ signal }) => {
      const current = subject.value;
      if (!current) return "";
      return shellCommand(current.serial, `dumpsys package ${current.packageName}`, { signal });
    },
    enabled: computed(() => subject.value !== null),
    staleTime: DUMP_STALE_MS,
  });

  const permissions = computed(() =>
    query.data.value ? parsePermissions(query.data.value) : null,
  );
  const capacitor = computed(() => (query.data.value ? detectCapacitor(query.data.value) : null));
  const uid = computed(() =>
    query.data.value === undefined ? undefined : uidFromDump(query.data.value),
  );

  return { query, permissions, capacitor, uid };
}
