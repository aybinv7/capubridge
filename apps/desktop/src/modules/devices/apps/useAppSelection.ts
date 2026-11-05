import { computed, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { watchDebounced } from "@vueuse/core";
import type { AdbPackage } from "@/types/adb.types";
import { scopeShowing, type AppScope } from "./appsModel";

const URL_SYNC_DEBOUNCE_MS = 200;

/**
 * The selected app and the scope it is shown in. The selection follows `?package=` both ways, is
 * cleared when the phone changes, and an app asked for by link that the saved scope hides widens
 * the scope for this visit only, never in the saved choice.
 */
export function useAppSelection(serial: Ref<string>, savedScope: Ref<AppScope>) {
  const route = useRoute();
  const router = useRouter();
  const selectedName = ref<string | null>(null);
  const scopeOverride = ref<AppScope | null>(null);
  const requested = ref<string | null>(null);

  const scope = computed(() => scopeOverride.value ?? savedScope.value);
  const queryPackage = computed(() => {
    if (route.name !== "devices-apps") return null;
    const raw = route.query.package;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" && value ? value : null;
  });

  function select(app: AdbPackage) {
    selectedName.value = app.packageName;
  }

  function clear() {
    selectedName.value = null;
  }

  function chooseScope(next: AppScope) {
    scopeOverride.value = null;
    savedScope.value = next;
  }

  watch(serial, (next, previous) => {
    if (previous === undefined || next === previous) return;
    selectedName.value = null;
    scopeOverride.value = null;
  });

  watch(
    queryPackage,
    (name) => {
      if (!name || name === selectedName.value) return;
      selectedName.value = name;
      requested.value = name;
    },
    { immediate: true },
  );

  watchDebounced(
    selectedName,
    (name) => {
      if (route.name !== "devices-apps" || queryPackage.value === name) return;
      void router.replace({ query: { ...route.query, package: name ?? undefined } });
    },
    { debounce: URL_SYNC_DEBOUNCE_MS },
  );

  /** Widens the scope for a linked app the listing has but the scope hides. */
  function watchListing(packages: Ref<readonly AdbPackage[] | undefined>) {
    watch(
      [packages, requested],
      ([list, name]) => {
        if (!list || !name) return;
        requested.value = null;
        const app = list.find((entry) => entry.packageName === name) ?? null;
        if (!scopeShowing(scope.value, app)) scopeOverride.value = "all";
      },
      { immediate: true },
    );
  }

  return { scope, selectedName, select, clear, chooseScope, watchListing };
}
