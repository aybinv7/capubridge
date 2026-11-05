<script setup lang="ts">
import { computed, ref } from "vue";
import { Button, Segmented, SegmentedButton, Spinner } from "@capubridge/cladd";
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import { useAppSession } from "../../appSession";
import PermissionsTable from "./PermissionsTable.vue";
import {
  PERMISSION_FILTERS,
  installTimePermissions,
  matchesPermissionFilter,
  permissionCounts,
  sortPermissions,
  type PermissionFilter,
  type PermissionSort,
} from "./permissionsView";
import { usePermissionChange } from "./usePermissionChange";

const { app, dump, process } = useAppSession();
const { change, confirm, confirmOpen, confirmRequest, changing, optimistic } = usePermissionChange({
  subject: app.subject,
  appName: app.name,
  user: dump.user,
  permissions: dump.permissions,
  reread: () => dump.query.refetch(),
  readProcess: () => process.readNow(),
});

const filter = ref<PermissionFilter>("all");
const sort = ref<PermissionSort>({ key: "attention", desc: false });

const query = dump.query;
const runtime = computed(() => {
  const list = dump.permissions.value?.runtime ?? [];
  const asked = optimistic.value;
  if (!asked) return list;
  return list.map((permission) =>
    permission.name === asked.name ? { ...permission, granted: asked.granted } : permission,
  );
});
const counts = computed(() => permissionCounts(runtime.value));
const allSensitive = computed(() => counts.value.sensitive === counts.value.total);
const filters = computed(() =>
  allSensitive.value
    ? PERMISSION_FILTERS.filter((option) => option.value !== "sensitive")
    : PERMISSION_FILTERS,
);
const activeFilter = computed<PermissionFilter>(() =>
  allSensitive.value && filter.value === "sensitive" ? "all" : filter.value,
);
const sorted = computed(() => sortPermissions(runtime.value, sort.value));
const visible = computed(() =>
  sorted.value.filter((permission) => matchesPermissionFilter(permission, activeFilter.value)),
);
const installTime = computed(() => installTimePermissions(dump.permissions.value));
const summary = computed(() => {
  const { total, granted, denied, sensitive } = counts.value;
  if (!total) return "";
  const parts = [`${total} asked while running`, `${granted} allowed`, `${denied} denied`];
  if (!allSensitive.value && sensitive) parts.push(`${sensitive} sensitive`);
  return parts.join(" · ");
});
</script>

<template>
  <section class="flex flex-col gap-3" aria-labelledby="app-permissions-title">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 id="app-permissions-title" class="text-sm font-medium text-foreground">Permissions</h2>
      <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground tabular-nums">
        {{ summary }}
      </span>
      <Segmented v-if="counts.total" size="sm" active-variant="solid" aria-label="Show permissions">
        <SegmentedButton
          v-for="option in filters"
          :key="option.value"
          :active="activeFilter === option.value"
          :class="SEGMENT_TEXT"
          @click="filter = option.value"
        >
          {{ option.label }}
        </SegmentedButton>
      </Segmented>
    </header>

    <div v-if="query.isLoading.value" class="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner size="xs" />
      Reading the app's permissions
    </div>
    <div
      v-else-if="query.isError.value && !query.data.value"
      class="flex items-start gap-3 rounded-control bg-surface-cut px-3 py-2.5 shadow-cut"
      role="alert"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <p class="text-xs text-foreground">The phone did not send the app's permissions.</p>
        <p class="font-mono text-2xs break-all text-error">{{ query.error.value }}</p>
      </div>
      <Button size="sm" variant="transparent" @click="query.refetch()">Try again</Button>
    </div>
    <p v-else-if="!counts.total" class="text-xs text-muted-foreground">
      {{
        query.data.value
          ? "The app asks for no permissions while it runs."
          : "The permissions are read with the app's details."
      }}
    </p>
    <template v-else>
      <PermissionsTable
        v-if="visible.length"
        v-model:sort="sort"
        :permissions="visible"
        :changing="changing"
        :mark-sensitive="!allSensitive"
        @change="change"
      />
      <p v-else class="text-xs text-muted-foreground">
        No permission matches this filter.
        <button
          type="button"
          class="underline-offset-2 hover:text-foreground hover:underline"
          @click="filter = 'all'"
        >
          Show all
        </button>
      </p>
    </template>

    <div v-if="installTime.length" class="flex flex-col gap-1.5">
      <h3 class="text-xs text-muted-foreground">Granted when installed</h3>
      <ul
        class="flex flex-wrap gap-x-1 text-xs text-[var(--fg-subtle)]"
        aria-label="Granted when installed"
      >
        <li v-for="(permission, index) in installTime" :key="permission.name">
          <HintTooltip :text="permission.name">
            <span class="hover:text-muted-foreground">{{ permission.label }}</span>
          </HintTooltip>
          <span v-if="index < installTime.length - 1" aria-hidden="true">,</span>
        </li>
      </ul>
    </div>

    <ConfirmDialog v-model:open="confirmOpen" :request="confirmRequest" @confirm="confirm()" />
  </section>
</template>
