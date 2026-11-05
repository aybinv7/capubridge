<script setup lang="ts">
import { computed } from "vue";
import { getCoreRowModel, useVueTable, type ColumnDef } from "@tanstack/vue-table";
import { Button, StatusDot } from "@capubridge/cladd";
import type { AppPermission } from "@/types/app-inspector.types";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import SortHeader from "@/shared/components/presentation/SortHeader.vue";
import {
  isFixedPermission,
  permissionGroup,
  permissionLabel,
  type PermissionSort,
  type PermissionSortKey,
} from "./permissionsView";

const COLUMNS = "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6rem_5.5rem]";

const props = defineProps<{
  permissions: readonly AppPermission[];
  changing: string | null;
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
    return {
      permission,
      label: permissionLabel(permission.shortName),
      group: permissionGroup(permission),
      fixed: isFixedPermission(permission),
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
        <SortHeader label="State" :state="sortState('state')" @toggle="toggleSort('state')" />
      </span>
      <span role="columnheader" class="sr-only">Change</span>
    </div>
    <div
      v-for="row in rows"
      :key="row.permission.name"
      role="row"
      class="group/row grid min-h-7.5 items-center gap-3 rounded-control px-2.5 hover:bg-cladd-surface-hover"
      :class="COLUMNS"
    >
      <span role="cell" class="flex min-w-0 flex-col py-1">
        <span class="truncate text-sm text-foreground">{{ row.label }}</span>
        <span
          class="truncate font-mono text-2xs text-[var(--fg-subtle)]"
          :title="row.permission.flags ? `Flags: ${row.permission.flags}` : row.permission.name"
        >
          {{ row.permission.name }}
        </span>
      </span>
      <span role="cell" class="truncate text-xs text-muted-foreground">
        {{ row.group }}
        <span v-if="row.permission.isDangerous" class="text-[var(--fg-subtle)]"> · sensitive</span>
      </span>
      <span role="cell" class="flex items-center gap-1.5 text-xs">
        <StatusDot :variant="row.permission.granted ? 'solid' : 'hollow'" />
        <span :class="row.permission.granted ? 'text-foreground' : 'text-muted-foreground'">
          {{ row.permission.granted ? "Allowed" : "Denied" }}
        </span>
      </span>
      <span role="cell" class="flex justify-end">
        <HintTooltip :text="row.fixed ? 'Android or a device policy holds this permission' : null">
          <Button
            size="xs"
            variant="transparent"
            :outline="false"
            :disabled="row.fixed || props.changing !== null"
            :loading="props.changing === row.permission.name"
            class="text-muted-foreground hover:text-foreground"
            :aria-label="`${row.permission.granted ? 'Deny' : 'Allow'} ${row.label}`"
            @click="emit('change', row.permission)"
          >
            {{ row.permission.granted ? "Deny" : "Allow" }}
          </Button>
        </HintTooltip>
      </span>
    </div>
  </div>
</template>
