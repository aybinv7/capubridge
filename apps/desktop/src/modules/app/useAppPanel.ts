import { computed } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { useAppInspector } from "@/composables/useAppInspector";
import { useAppPackages } from "@/composables/useAppPackages";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";

export function useAppPanel() {
  const router = useRouter();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const { getPackageDetails, openPackage, shellCommand } = useAdb();

  const selectedTarget = computed(() => {
    const target = targetsStore.selectedTarget;
    if (!target || target.source !== "adb" || !target.packageName) {
      return null;
    }
    return target;
  });

  const serial = computed(
    () => selectedTarget.value?.deviceSerial ?? devicesStore.selectedDevice?.serial ?? "",
  );
  const packageName = computed(() => selectedTarget.value?.packageName ?? "");

  const { usePackages } = useAppPackages(serial);
  const { data: packages } = usePackages(computed(() => "all" as const));

  const selectedPackage = computed(
    () => packages.value?.find((entry) => entry.packageName === packageName.value) ?? null,
  );

  const detailsQuery = useQuery({
    queryKey: computed(() => ["app-panel-details", serial.value, packageName.value]),
    queryFn: () => getPackageDetails(serial.value, packageName.value),
    enabled: computed(() => !!serial.value && !!packageName.value),
    staleTime: 15_000,
  });

  const inspector = useAppInspector(serial, packageName);

  async function launchApp() {
    if (!serial.value || !packageName.value) {
      return;
    }
    try {
      await openPackage(serial.value, packageName.value);
      toast.success("App launched", { description: packageName.value });
    } catch (error) {
      toast.error("Failed to launch app", { description: String(error) });
    }
  }

  async function forceStopApp() {
    if (!serial.value || !packageName.value) {
      return;
    }
    await shellCommand(serial.value, `am force-stop ${packageName.value}`);
  }

  async function clearAppData() {
    if (!serial.value || !packageName.value) {
      return "";
    }
    return shellCommand(serial.value, `pm clear ${packageName.value}`);
  }

  async function openFiles(path: string) {
    await router.push({
      name: "devices-files",
      query: { path },
    });
  }

  async function openIndexedDb() {
    await router.push("/storage/indexeddb");
  }

  async function openSqlite() {
    await router.push("/storage/sqlite");
  }

  async function openCapacitor() {
    await router.push("/capacitor/bridge");
  }

  return {
    selectedTarget,
    serial,
    packageName,
    selectedPackage,
    detailsQuery,
    inspector,
    launchApp,
    forceStopApp,
    clearAppData,
    openFiles,
    openIndexedDb,
    openSqlite,
    openCapacitor,
  };
}
