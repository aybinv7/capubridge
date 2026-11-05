import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useAdb } from "@/composables/useAdb";
import { PACKAGE_CACHE_STALE_MS, useAppPackages } from "@/composables/useAppPackages";
import { targetAppName } from "@/lib/target-app-name";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useTargetsStore } from "@/stores/targets.store";
import { isPackageName } from "./packageName";
import type { AppSubject } from "./subject.types";

/** Query key of an app's package details; the Device route reads the same entry. */
export function packageDetailsKey(subject: AppSubject | null): readonly unknown[] {
  return ["package-details", subject?.serial ?? "", subject?.packageName ?? ""];
}

/**
 * The app behind the selected target: its phone and package, its installed entry, its details
 * and the name a person knows it by. A package name that is not one never reaches the shell.
 */
export function createInspectedApp() {
  const targets = useTargetsStore();
  const devices = useDevicesStore();
  const presenceStore = useTargetPresenceStore();
  const { getPackageDetails } = useAdb();

  const target = computed(() => {
    const selected = targets.selectedTarget;
    return selected?.source === "adb" && selected.packageName ? selected : null;
  });
  const serial = computed(() => target.value?.deviceSerial ?? devices.selectedDevice?.serial ?? "");
  const packageName = computed(() => {
    const name = target.value?.packageName;
    return isPackageName(name) ? name : "";
  });
  const subject = computed<AppSubject | null>(() =>
    serial.value && packageName.value
      ? { serial: serial.value, packageName: packageName.value }
      : null,
  );

  const { usePackages, getCachedPackage } = useAppPackages(serial);
  const { data: listing } = usePackages("third-party", {
    enabled: computed(() => subject.value !== null),
  });
  const entry = computed(() => {
    const name = packageName.value;
    if (!name) return null;
    return listing.value?.find((app) => app.packageName === name) ?? getCachedPackage(name);
  });

  const details = useQuery({
    queryKey: computed(() => packageDetailsKey(subject.value)),
    queryFn: () => {
      const current = subject.value;
      if (!current) throw new Error("No app is selected");
      return getPackageDetails(current.serial, current.packageName);
    },
    enabled: computed(() => subject.value !== null),
    staleTime: PACKAGE_CACHE_STALE_MS,
  });

  const name = computed(() => targetAppName(target.value, entry.value?.label) ?? packageName.value);
  const presence = computed(() => presenceStore.presence);

  return {
    target,
    serial,
    packageName,
    subject,
    entry,
    details,
    name,
    presence,
    probePresence: () => presenceStore.probeNow(),
  };
}

export type InspectedApp = ReturnType<typeof createInspectedApp>;
