import { computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useAdb } from "@/composables/useAdb";
import { PACKAGE_CACHE_STALE_MS, useAppPackages } from "@/composables/useAppPackages";
import { targetAppName } from "@/lib/target-app-name";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useTargetsStore } from "@/stores/targets.store";
import { packageOfTarget } from "./packageName";
import type { AppSubject } from "./subject.types";

/** Query key of an app's package details; the Device route reads the same entry. */
export function packageDetailsKey(subject: AppSubject | null): readonly unknown[] {
  return ["package-details", subject?.serial ?? "", subject?.packageName ?? ""];
}

/**
 * The app behind the selected target: its phone and package, its installed entry, its details
 * and the name a person knows it by. A package name that is not one never reaches the shell.
 * The entry comes from the cached app lists; only when the app is in none of them (a system app,
 * or nothing listed yet) is the phone asked, once per app.
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
  const packageName = computed(() => packageOfTarget(target.value?.packageName) ?? "");
  /** A target is selected but it names no app the phone could be asked about. */
  const unknownApp = computed(() => target.value !== null && !packageName.value);
  const subject = computed<AppSubject | null>(() =>
    serial.value && packageName.value
      ? { serial: serial.value, packageName: packageName.value }
      : null,
  );
  const deviceOnline = computed(
    () => devices.devices.find((device) => device.serial === serial.value)?.status === "online",
  );

  const { getCachedPackage, ensurePackages } = useAppPackages(serial);
  const entry = computed(() => (packageName.value ? getCachedPackage(packageName.value) : null));

  watch(
    () => (subject.value && deviceOnline.value ? `${serial.value}/${packageName.value}` : null),
    async (key) => {
      const name = packageName.value;
      if (!key || getCachedPackage(name)) return;
      try {
        await ensurePackages("third-party");
        if (!getCachedPackage(name)) await ensurePackages("all");
      } catch (error) {
        console.warn("Could not list the phone's apps for the inspected app", error);
      }
    },
    { immediate: true },
  );

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
    unknownApp,
    subject,
    deviceOnline,
    entry,
    details,
    name,
    presence,
    probePresence: () => presenceStore.probeNow(),
  };
}

export type InspectedApp = ReturnType<typeof createInspectedApp>;
