<script setup lang="ts">
import { computed } from "vue";
import { getCoreRowModel, useVueTable, type ColumnDef } from "@tanstack/vue-table";
import { Spinner, Switch } from "@capubridge/cladd";
import type { AppPermission } from "@/types/app-inspector.types";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import SortHeader from "@/shared/components/presentation/SortHeader.vue";
import {
  fixedReason,
  isFixedPermission,
  permissionGroup,
  permissionLabel,
  type PermissionSort,
  type PermissionSortKey,
} from "./permissionsView";

const COLUMNS = "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7.5rem]";

const props = defineProps<{
  permissions: readonly AppPermission[];
  changing: string | null;
  /** Show "· sensitive" beside the group; pointless when every permission is sensitive. */
  markSensitive: boolean;
}>();

const sort = defineModel<PermissionSort>("sort", { required: true });

const emit = defineEmits<{ change: [permission: AppPermission] }>();

const columns: ColumnDef<AppPermission>[] = [
  { id: "name", accessorFn: (permission) => permissionLabel(permission.shortName) },
  { id: "group", accessorFn: (permission) => permissionGroup(permission) },
  { id: "state", accessorKey: "granted" },
];
const table = useVueTable({
  get data() {
    return props.permissions as AppPermission[];
  },
  columns,
  manualSorting: true,
  getCoreRowModel: getCoreRowModel(),
});
const rows = computed(() =>
  table.getRowModel().rows.map((row) => {
    const permission = row.original;
    const fixed = isFixedPermission(permission);
    const label = permissionLabel(permission.shortName);
    return {
      permission,
      label,
      group: permissionGroup(permission),
      fixed,
      hint: fixed
        ? fixedReason(permission)
        : `${permission.name}${permission.flags ? ` · ${permission.flags}` : ""}`,
      action: `${permission.granted ? "Deny" : "Allow"} ${label}`,
    };
  }),
);

function sortState(key: PermissionSortKey): "asc" | "desc" | false {
  return sort.value.key === key ? (sort.value.desc ? "desc" : "asc") : false;
}

function toggleSort(key: PermissionSortKey) {
  if (sort.value.key !== key) sort.value = { key, desc: false };
  else if (!sort.value.desc) sort.value = { key, desc: true };
  else sort.value = { key: "attention", desc: false };
}
</script>

<template>
  <div role="table" aria-label="Runtime permissions" class="flex flex-col">
    <div
      role="row"
      class="grid h-7 items-center gap-3 border-b border-border-subtle px-2.5"
      :class="COLUMNS"
    >
      <span role="columnheader">
        <SortHeader label="Permission" :state="sortState('name')" @toggle="toggleSort('name')" />
      </span>
      <span role="columnheader">
        <SortHeader label="Group" :state="sortState('group')" @toggle="toggleSort('group')" />
      </span>
      <span role="columnheader">
        <SortHeader label="Allowed" :state="sortState('state')" @toggle="toggleSort('state')" />
      </span>
    </div>
    <div
      v-for="row in rows"
      :key="row.permission.name"
      role="row"
      class="grid min-h-7.5 items-center gap-3 rounded-control px-2.5 hover:bg-cladd-surface-hover"
      :class="COLUMNS"
    >
      <span role="cell" class="flex min-w-0 flex-col py-1">
        <span class="truncate text-sm text-foreground">{{ row.label }}</span>
        <HintTooltip :text="row.hint" position="bottom">
          <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
            {{ row.permission.name }}
          </span>
        </HintTooltip>
      </span>
      <span role="cell" class="truncate text-xs text-muted-foreground">
        {{ row.group }}
        <span
          v-if="props.markSensitive && row.permission.isDangerous"
          class="text-[var(--fg-subtle)]"
        >
          · sensitive
        </span>
      </span>
      <span role="cell" class="flex items-center gap-2 text-xs">
        <HintTooltip :text="row.fixed ? row.hint : null">
          <Switch
            size="sm"
            :model-value="row.permission.granted"
            :disabled="row.fixed || props.changing !== null"
            :aria-label="row.action"
            @update:model-value="emit('change', row.permission)"
          />
        </HintTooltip>
        <Spinner v-if="props.changing === row.permission.name" size="xs" />
        <span v-else :class="row.permission.granted ? 'text-foreground' : 'text-muted-foreground'">
          {{ row.permission.granted ? "Allowed" : "Denied" }}
        </span>
      </span>
    </div>
  </div>
</template>
