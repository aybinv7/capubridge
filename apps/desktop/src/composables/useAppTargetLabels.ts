import { computed, watch } from "vue";
import { useAppPackages } from "@/composables/useAppPackages";
import { useSessionStore } from "@/stores/session.store";
import { useTargetsStore } from "@/stores/targets.store";

/**
 * Gives the active device's app targets the names people know them by. Labels come from the
 * installed-apps listing; it is read once per device when an app target has no cached label.
 */
export function useAppTargetLabels() {
  const targetsStore = useTargetsStore();
  const session = useSessionStore();
  const serial = computed(() => session.selectedDevice?.serial ?? "");
  const { getCachedPackage, ensurePackages } = useAppPackages(serial);
  const listed = new Set<string>();

  const packages = computed(() => targetsStore.debuggablePackages.get(serial.value) ?? []);

  const labels = computed(() => {
    const result: Record<string, string> = {};
    for (const name of packages.value) {
      const label = getCachedPackage(name)?.label?.trim();
      if (label) result[name] = label;
    }
    return result;
  });

  const labelsKey = computed(() =>
    Object.entries(labels.value)
      .map(([name, label]) => `${name}=${label}`)
      .join("\n"),
  );

  watch(labelsKey, () => {
    if (serial.value) targetsStore.setAppLabels(serial.value, labels.value);
  });

  async function listInstalledApps(current: string) {
    listed.add(current);
    try {
      await ensurePackages("third-party");
    } catch (error) {
      listed.delete(current);
      console.warn("Could not read app names for the debuggable apps of", current, error);
    }
  }

  watch(
    [serial, packages],
    ([current, names]) => {
      if (!current || listed.has(current)) return;
      if (names.some((name) => !getCachedPackage(name))) void listInstalledApps(current);
    },
    { immediate: true },
  );
}
