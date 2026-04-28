<script setup lang="ts">
import { computed, ref } from "vue";
import { AlertCircle, Loader2, RefreshCw, ShieldCheck, ShieldOff, ShieldX } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppPermission, AppPermissionsData } from "@/types/app-inspector.types";

const props = defineProps<{
  permissions: AppPermissionsData | null;
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ refresh: [] }>();

type Filter = "all" | "dangerous" | "granted" | "denied";

const filter = ref<Filter>("all");

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "dangerous", label: "Sensitive" },
  { key: "granted", label: "Granted" },
  { key: "denied", label: "Denied" },
];

const GROUPS: Record<string, string> = {
  CAMERA: "Camera",
  RECORD_AUDIO: "Microphone",
  ACCESS_FINE_LOCATION: "Location",
  ACCESS_COARSE_LOCATION: "Location",
  ACCESS_BACKGROUND_LOCATION: "Location",
  READ_CONTACTS: "Contacts",
  WRITE_CONTACTS: "Contacts",
  GET_ACCOUNTS: "Contacts",
  READ_EXTERNAL_STORAGE: "Storage",
  WRITE_EXTERNAL_STORAGE: "Storage",
  READ_MEDIA_IMAGES: "Media",
  READ_MEDIA_VIDEO: "Media",
  READ_MEDIA_AUDIO: "Media",
  READ_PHONE_STATE: "Phone",
  CALL_PHONE: "Phone",
  READ_CALL_LOG: "Phone",
  SEND_SMS: "SMS",
  READ_SMS: "SMS",
  RECEIVE_SMS: "SMS",
  BLUETOOTH_CONNECT: "Bluetooth",
  BLUETOOTH_SCAN: "Bluetooth",
  POST_NOTIFICATIONS: "Notifications",
  ACTIVITY_RECOGNITION: "Activity",
  BODY_SENSORS: "Sensors",
};

function applyFilter(permission: AppPermission) {
  if (filter.value === "dangerous") return permission.isDangerous;
  if (filter.value === "granted") return permission.granted;
  if (filter.value === "denied") return !permission.granted;
  return true;
}

function groupLabel(permission: AppPermission) {
  return GROUPS[permission.shortName] ?? "Other";
}

const runtimePermissions = computed(() => props.permissions?.runtime ?? []);
const visibleRuntimePermissions = computed(() =>
  runtimePermissions.value.filter(applyFilter).sort((left, right) => {
    if (left.granted !== right.granted) return left.granted ? 1 : -1;
    if (left.isDangerous !== right.isDangerous) return left.isDangerous ? -1 : 1;
    return groupLabel(left).localeCompare(groupLabel(right));
  }),
);

const stats = computed(() => ({
  total: runtimePermissions.value.length,
  granted: runtimePermissions.value.filter((entry) => entry.granted).length,
  denied: runtimePermissions.value.filter((entry) => !entry.granted).length,
  sensitive: runtimePermissions.value.filter((entry) => entry.isDangerous).length,
}));

const installTimeOnly = computed(() => {
  const runtimeNames = new Set(runtimePermissions.value.map((permission) => permission.name));
  return (props.permissions?.requested ?? []).filter((name) => !runtimeNames.has(name));
});
</script>

<template>
  <div class="min-h-0 overflow-hidden">
    <div class="flex h-9 items-center gap-3 border-b border-border/20 bg-surface-1 px-3">
      <div class="flex items-center gap-2 text-xs font-medium text-foreground/80">Permissions</div>
      <div class="flex items-center gap-2 text-[10px] text-muted-foreground/55">
        <span>{{ stats.total }} runtime</span>
        <span class="text-emerald-400">{{ stats.granted }} granted</span>
        <span class="text-red-400">{{ stats.denied }} denied</span>
        <span class="text-amber-400">{{ stats.sensitive }} sensitive</span>
      </div>
      <div class="ml-auto flex items-center gap-1">
        <button
          v-for="item in FILTERS"
          :key="item.key"
          class="h-6 rounded px-2 text-[11px] transition-colors"
          :class="
            filter === item.key
              ? 'bg-surface-3 text-foreground'
              : 'text-muted-foreground/55 hover:bg-surface-2 hover:text-foreground/75'
          "
          @click="filter = item.key"
        >
          {{ item.label }}
        </button>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 gap-1.5 px-2 text-[11px]"
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <Loader2 v-if="isLoading" class="h-3.5 w-3.5 animate-spin" />
          <RefreshCw v-else class="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>

    <div
      v-if="error"
      class="flex items-start gap-2 border-b border-red-500/20 bg-red-500/6 px-3 py-2 text-xs text-red-300"
    >
      <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span class="font-mono text-[11px]">{{ error }}</span>
    </div>

    <div
      v-if="isLoading && !permissions"
      class="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground/50"
    >
      <Loader2 class="h-3.5 w-3.5 animate-spin" />
      Loading permissions
    </div>

    <div
      v-else-if="!permissions && !isLoading"
      class="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground/45"
    >
      <ShieldOff class="h-4 w-4" />
      Refresh to load permissions
    </div>

    <div
      v-else-if="visibleRuntimePermissions.length === 0"
      class="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground/45"
    >
      <ShieldOff class="h-4 w-4" />
      No permissions match filter
    </div>

    <div v-else class="overflow-auto">
      <table class="w-full table-fixed text-xs">
        <thead class="sticky top-0 z-10 bg-surface-2">
          <tr
            class="border-b border-border/25 text-left text-[10px] uppercase text-muted-foreground/45"
          >
            <th class="w-8 px-3 py-2" />
            <th class="w-[24%] px-3 py-2 font-medium">Name</th>
            <th class="w-[42%] px-3 py-2 font-medium">Android permission</th>
            <th class="w-[14%] px-3 py-2 font-medium">Group</th>
            <th class="w-[12%] px-3 py-2 font-medium">Status</th>
            <th class="w-[8%] px-3 py-2 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="permission in visibleRuntimePermissions"
            :key="permission.name"
            class="border-b border-border/15 hover:bg-surface-2/50"
          >
            <td class="px-3 py-2">
              <component
                :is="permission.granted ? ShieldCheck : ShieldX"
                class="h-3.5 w-3.5"
                :class="permission.granted ? 'text-emerald-500' : 'text-red-500'"
              />
            </td>
            <td class="truncate px-3 py-2 font-medium" :title="permission.shortName">
              {{ permission.shortName }}
            </td>
            <td
              class="truncate px-3 py-2 font-mono text-[11px] text-muted-foreground/60"
              :title="permission.name"
            >
              {{ permission.name }}
            </td>
            <td class="truncate px-3 py-2 text-muted-foreground/60">
              {{ groupLabel(permission) }}
            </td>
            <td class="px-3 py-2">
              <Badge
                variant="outline"
                class="h-5 border-border/40 px-1.5 text-[10px]"
                :class="permission.granted ? 'text-emerald-400' : 'text-red-400'"
              >
                {{ permission.granted ? "Granted" : "Denied" }}
              </Badge>
            </td>
            <td class="truncate px-3 py-2 font-mono text-[10px] text-muted-foreground/45">
              {{ permission.flags || "—" }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="installTimeOnly.length" class="border-t border-border/20 px-3 py-2">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="mr-1 text-[10px] uppercase text-muted-foreground/40"> Install-time </span>
        <Badge
          v-for="name in installTimeOnly"
          :key="name"
          variant="outline"
          class="max-w-full truncate border-border/35 font-mono text-[10px] text-muted-foreground/60"
        >
          {{ name.replace("android.permission.", "") }}
        </Badge>
      </div>
    </div>
  </div>
</template>
