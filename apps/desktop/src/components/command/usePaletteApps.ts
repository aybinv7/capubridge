import { computed, type Ref } from "vue";
import { useAppPackages } from "@/composables/useAppPackages";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useCommandsStore } from "@/stores/commands.store";
import { useAppActions } from "@/shared/apps/useAppActions";
import type { PaletteApp } from "@/lib/commands/palette/items";

export type PaletteAppsState = "no-device" | "offline" | "loading" | "error" | "ready";

/**
 * The selected device's installed apps for the palette. The list is read only once the palette is
 * in its `open` mode (`wanted`); before that a list already cached for the device is still
 * searched, so a plain search can offer an app. Launching reuses the Device › Apps action.
 */
export function usePaletteApps(wanted: Ref<boolean>) {
  const context = useActiveContextStore();
  const commands = useCommandsStore();

  const device = computed(() => context.device);
  const serial = computed(() => {
    const current = device.value;
    return current?.status === "online" && !current.isStale ? current.serial : "";
  });

  const { usePackages } = useAppPackages(serial);
  const query = usePackages("third-party", { enabled: wanted });
  const actions = useAppActions(serial);

  const apps = computed<PaletteApp[]>(() => {
    const current = serial.value;
    if (!current) return [];
    return (query.data.value ?? [])
      .filter((entry) => entry.enabled)
      .map((entry) => ({
        serial: current,
        packageName: entry.packageName,
        apkPath: entry.apkPath,
        iconPath: entry.iconPath ?? null,
        label: entry.label ?? null,
        system: entry.system,
      }));
  });

  const state = computed<PaletteAppsState>(() => {
    if (!device.value) return "no-device";
    if (!serial.value) return "offline";
    if (apps.value.length > 0) return "ready";
    if (query.isError.value) return "error";
    if (query.isFetching.value || query.isPending.value) return "loading";
    return "ready";
  });

  const error = computed(() => (query.error.value ? String(query.error.value) : null));

  async function open(app: PaletteApp) {
    commands.rememberApp(app.packageName);
    await actions.launch(app);
  }

  return { apps, state, error, open };
}
