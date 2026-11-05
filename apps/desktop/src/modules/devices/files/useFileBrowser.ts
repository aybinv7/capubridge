import { computed, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { refDebounced, useDocumentVisibility, useStorage } from "@vueuse/core";
import { invokeCommand } from "@/runtime/ipc/client";
import { useAdb } from "@/composables/useAdb";
import { useDevicesStore } from "@/stores/devices.store";
import {
  DEVICE_SEARCH_DEBOUNCE_MS,
  DEVICE_SEARCH_MIN_CHARS,
  deviceSearchCommand,
  parseDeviceSearch,
} from "./deviceFileSearch";
import {
  entriesWithPaths,
  filterEntries,
  normalizePath,
  parentPath,
  sortEntries,
  type DeviceFileListEntry,
  type FileSort,
} from "./filePaths";
import { HOME_FOLDER, type FilesView, type SearchScope } from "./filesView";
import { useFileTree } from "./useFileTree";

/**
 * Everything the Files tab knows: the open folder and its listing, the whole-device search, the
 * selection, the view settings and the folder tree. Reads only; writes live in `useFileActions`.
 */
export function useFileBrowser() {
  const devices = useDevicesStore();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { shellCommand } = useAdb();
  const visibility = useDocumentVisibility();

  const serial = computed(() => devices.selectedDevice?.serial ?? "");
  const dir = ref(HOME_FOLDER);
  const lastFolders = useStorage<Record<string, string>>("capubridge:device-files:last", {});
  const selectedPath = ref<string | null>(null);
  const showHidden = ref(false);
  const detailsOpen = ref(false);
  const view = useStorage<FilesView>("capubridge:device-files:view", "list");
  const refreshEveryMs = useStorage<number>("capubridge:device-files:refresh", 0);
  const sort = shallowRef<FileSort>({ key: "name", desc: false });
  const query = ref("");
  const scope = ref<SearchScope>("folder");
  const debouncedQuery = refDebounced(
    computed(() => (scope.value === "device" ? query.value.trim() : "")),
    DEVICE_SEARCH_DEBOUNCE_MS,
  );
  const tree = useFileTree(serial);
  let neighbourAfterDelete: number | null = null;

  const requestedPath = computed(() => {
    const raw = route.query.path;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" ? normalizePath(value) : null;
  });
  const onFilesRoute = computed(() => route.name === "devices-files");
  const liveRefresh = computed(
    () =>
      refreshEveryMs.value > 0 &&
      onFilesRoute.value &&
      visibility.value === "visible" &&
      scope.value === "folder" &&
      !!serial.value,
  );

  const listing = useQuery({
    queryKey: computed(() => ["adb-dir", serial.value, dir.value]),
    queryFn: () => invokeCommand("adb_list_dir", { serial: serial.value, path: dir.value }),
    enabled: computed(() => !!serial.value),
    staleTime: 15_000,
    refetchInterval: computed(() => (liveRefresh.value ? refreshEveryMs.value : false)),
  });

  const deviceSearch = useQuery({
    queryKey: computed(() => ["adb-system-search", serial.value, debouncedQuery.value]),
    queryFn: async () => {
      const command = deviceSearchCommand(debouncedQuery.value);
      return command ? parseDeviceSearch(await shellCommand(serial.value, command)) : [];
    },
    enabled: computed(
      () =>
        !!serial.value &&
        scope.value === "device" &&
        debouncedQuery.value.length >= DEVICE_SEARCH_MIN_CHARS,
    ),
    staleTime: 5_000,
  });

  const sortedListing = computed(() =>
    sortEntries(entriesWithPaths(listing.data.value ?? [], dir.value), sort.value),
  );
  const sortedSearch = computed(() => sortEntries(deviceSearch.data.value ?? [], sort.value));
  const entries = computed<DeviceFileListEntry[]>(() => {
    if (scope.value === "device") return sortedSearch.value;
    return filterEntries(sortedListing.value, { showHidden: showHidden.value, query: query.value });
  });
  const loading = computed(() =>
    scope.value === "device" ? deviceSearch.isFetching.value : listing.isLoading.value,
  );
  const errorText = computed(() => {
    if (scope.value === "device") {
      return deviceSearch.isError.value ? String(deviceSearch.error.value ?? "Search failed") : "";
    }
    return listing.isError.value ? String(listing.error.value ?? "Could not read the folder") : "";
  });
  const needsQuery = computed(
    () => scope.value === "device" && query.value.trim().length < DEVICE_SEARCH_MIN_CHARS,
  );
  const selected = computed(
    () => entries.value.find((entry) => entry.path === selectedPath.value) ?? null,
  );

  function leaveSearch() {
    query.value = "";
    scope.value = "folder";
  }

  function openFolder(path: string) {
    leaveSearch();
    dir.value = normalizePath(path);
    selectedPath.value = null;
  }

  function openParent() {
    if (dir.value !== "/") openFolder(parentPath(dir.value));
  }

  function select(entry: DeviceFileListEntry | null) {
    selectedPath.value = entry?.path ?? null;
  }

  function moveSelection(step: number) {
    const list = entries.value;
    if (!list.length) return -1;
    const current = list.findIndex((entry) => entry.path === selectedPath.value);
    const next = Math.max(0, Math.min(list.length - 1, (current < 0 ? 0 : current) + step));
    selectedPath.value = list[next]?.path ?? null;
    return next;
  }

  function rememberNeighbour(entry: DeviceFileListEntry) {
    const index = entries.value.findIndex((item) => item.path === entry.path);
    neighbourAfterDelete = Math.max(0, index - 1);
  }

  async function refresh() {
    if (scope.value === "device") {
      if (debouncedQuery.value) {
        await queryClient.invalidateQueries({
          queryKey: ["adb-system-search", serial.value, debouncedQuery.value],
        });
      }
      return;
    }
    const folder = dir.value;
    await tree.reload(folder, async () => (await listing.refetch()).data);
  }

  watch(
    [serial, requestedPath],
    ([nextSerial, path]) => {
      if (!nextSerial) return;
      dir.value = path ?? lastFolders.value[nextSerial] ?? HOME_FOLDER;
      selectedPath.value = null;
      detailsOpen.value = false;
      tree.reset();
      void tree.revealPath(dir.value);
    },
    { immediate: true },
  );

  watch(dir, (next, previous) => {
    if (serial.value) lastFolders.value = { ...lastFolders.value, [serial.value]: next };
    if (previous !== undefined && next !== previous) void tree.revealPath(next);
  });

  watch(
    () => listing.data.value,
    (listed) => {
      if (listed && scope.value === "folder") tree.remember(dir.value, listed);
    },
    { immediate: true },
  );

  watch(
    entries,
    (list) => {
      if (!list.length) {
        selectedPath.value = null;
        return;
      }
      if (neighbourAfterDelete !== null) {
        selectedPath.value = list[Math.min(list.length - 1, neighbourAfterDelete)]?.path ?? null;
        neighbourAfterDelete = null;
      } else if (!list.some((entry) => entry.path === selectedPath.value)) {
        selectedPath.value = list[0]?.path ?? null;
      }
    },
    { immediate: true },
  );

  return {
    serial,
    dir,
    entries,
    selected,
    selectedPath,
    loading,
    errorText,
    needsQuery,
    showHidden,
    detailsOpen,
    view,
    refreshEveryMs,
    sort,
    query,
    scope,
    tree,
    openFolder,
    openParent,
    select,
    moveSelection,
    rememberNeighbour,
    refresh,
  };
}
