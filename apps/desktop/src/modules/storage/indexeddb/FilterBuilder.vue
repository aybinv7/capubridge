<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Check, ChevronDown, Filter, X, Plus, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Table } from "@tanstack/vue-table";
import type { IDBRecord, StoreInfo } from "utils";
import type { AdvancedFilter, FilterOperator } from "./useAdvancedFilters";
import { OPERATORS } from "./useAdvancedFilters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { parseDate, type DateValue } from "@internationalized/date";

const props = defineProps<{
  table: Table<IDBRecord>;
  storeInfo?: StoreInfo[];
  storeName?: string;
  filters?: AdvancedFilter[];
}>();

const emit = defineEmits<{
  "update:filters": [filters: AdvancedFilter[]];
}>();

const isOpen = ref(false);
const localFilters = ref<AdvancedFilter[]>([]);

watch(
  () => props.filters,
  (newFilters) => {
    if (newFilters) {
      localFilters.value = [...newFilters];
    }
  },
  { immediate: true, deep: true },
);

const columns = computed(() => {
  return props.table
    .getAllLeafColumns()
    .filter((c) => c.id !== "__actions" && c.columnDef.enableHiding !== false)
    .map((col) => ({
      value: col.id,
      label: String(col.columnDef.header ?? col.id),
    }));
});

function getOperatorLabel(op: FilterOperator): string {
  return OPERATORS.find((o) => o.value === op)?.label ?? op;
}

function getColumnLabel(colId: string): string {
  return columns.value.find((c) => c.value === colId)?.label ?? colId;
}

function addNewFilter() {
  localFilters.value.push({
    id: `adv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    columnId: columns.value[0]?.value ?? "key",
    operator: "contains",
    value: "",
    logic: localFilters.value.length === 0 ? "and" : "or",
  });
}

function removeFilter(id: string) {
  const idx = localFilters.value.findIndex((f) => f.id === id);
  if (idx >= 0) {
    localFilters.value.splice(idx, 1);
  }
}

function applyFilters() {
  emit("update:filters", [...localFilters.value]);
  isOpen.value = false;
}

function cancelFilters() {
  if (props.filters) {
    localFilters.value = [...props.filters];
  }
  isOpen.value = false;
}

function parseFilterDate(value: string): DateValue | undefined {
  try {
    return parseDate(value.slice(0, 10));
  } catch {
    return undefined;
  }
}

function showCalendarPicker(operator: FilterOperator): boolean {
  const dateOps = ["gt", "gte", "lt", "lte", "equals"];
  return dateOps.includes(operator);
}

function onDateSelect(filter: AdvancedFilter, date: DateValue | undefined) {
  if (date) {
    filter.value = date.toString().slice(0, 10);
  }
}

function needsValue(operator: FilterOperator): boolean {
  return OPERATORS.find((o) => o.value === operator)?.needsValue ?? true;
}

const hasFilters = computed(() => localFilters.value.length > 0);
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-7 w-7 shrink-0 relative"
        title="Add advanced filter"
      >
        <Filter class="h-3.5 w-3.5" />
        <span
          v-if="hasFilters"
          class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      class="w-[520px] p-0 rounded-xl border border-border/50 shadow-lg"
      align="start"
    >
      <div class="flex flex-col rounded-xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-3 py-2.5 border-b border-border/20">
          <div class="flex items-center gap-2">
            <Filter class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">Filters</span>
            <span
              v-if="hasFilters"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {{ localFilters.length }}
            </span>
          </div>
          <button
            class="text-muted-foreground hover:text-foreground transition-colors"
            @click="cancelFilters"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Filters List -->
        <div class="max-h-[320px] overflow-y-auto p-2 space-y-1.5">
          <template v-for="(filter, idx) in localFilters" :key="filter.id">
            <!-- AND/OR row (own line) -->
            <div v-if="idx > 0" class="flex items-center justify-center py-0.5">
              <div class="h-px flex-1 bg-border/30" />
              <button
                class="h-6 px-2 text-[10px] font-medium rounded-full border border-border/30 bg-background hover:bg-muted transition-colors mx-2"
                :class="filter.logic === 'and' ? 'text-foreground' : 'text-muted-foreground'"
                @click="filter.logic = filter.logic === 'and' ? 'or' : 'and'"
              >
                {{ filter.logic.toUpperCase() }}
              </button>
              <div class="h-px flex-1 bg-border/30" />
            </div>

            <!-- Filter row -->
            <div class="flex items-center gap-1.5">
              <!-- Column Combobox -->
              <Popover>
                <PopoverTrigger as-child>
                  <button
                    class="h-8 px-2.5 text-xs justify-between min-w-[100px] shrink-0 bg-surface-3 border border-border/40 rounded-lg hover:bg-surface-2 transition-colors text-left"
                  >
                    <span class="truncate">{{ getColumnLabel(filter.columnId) }}</span>
                    <ChevronDown class="h-3 w-3 opacity-50 ml-1 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-[180px] p-0">
                  <Command>
                    <CommandInput placeholder="Search..." class="h-8" />
                    <CommandList>
                      <CommandEmpty>No result</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          v-for="col in columns"
                          :key="col.value"
                          :value="col.value"
                          class="text-xs"
                          @select="filter.columnId = col.value"
                        >
                          <Check
                            :class="
                              cn(
                                'mr-2 h-3.5 w-3.5',
                                filter.columnId === col.value ? 'opacity-100' : 'opacity-0',
                              )
                            "
                          />
                          {{ col.label }}
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <!-- Operator Combobox -->
              <Popover>
                <PopoverTrigger as-child>
                  <button
                    class="h-8 px-2.5 text-xs justify-between min-w-[80px] shrink-0 bg-surface-3 border border-border/40 rounded-lg hover:bg-surface-2 transition-colors text-left"
                  >
                    <span class="truncate">{{ getOperatorLabel(filter.operator) }}</span>
                    <ChevronDown class="h-3 w-3 opacity-50 ml-1 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-[160px] p-0">
                  <Command>
                    <CommandInput placeholder="Search..." class="h-8" />
                    <CommandList>
                      <CommandEmpty>No result</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          v-for="op in OPERATORS"
                          :key="op.value"
                          :value="op.value"
                          class="text-xs"
                          @select="filter.operator = op.value"
                        >
                          <Check
                            :class="
                              cn(
                                'mr-2 h-3.5 w-3.5',
                                filter.operator === op.value ? 'opacity-100' : 'opacity-0',
                              )
                            "
                          />
                          {{ op.label }}
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <!-- Value Input -->
              <Popover v-if="showCalendarPicker(filter.operator)">
                <PopoverTrigger as-child>
                  <button
                    class="h-8 px-2.5 text-xs justify-between min-w-[90px] shrink-0 bg-surface-3 border border-border/40 rounded-lg hover:bg-surface-2 transition-colors text-left"
                  >
                    <span class="truncate">{{ filter.value || "Pick date..." }}</span>
                    <ChevronDown class="h-3 w-3 opacity-50 ml-1 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar
                    :model-value="parseFilterDate(filter.value)"
                    @update:model-value="(d: DateValue | undefined) => onDateSelect(filter, d)"
                  />
                </PopoverContent>
              </Popover>

              <Input
                v-else-if="needsValue(filter.operator)"
                v-model="filter.value"
                placeholder="Value"
                class="h-8 text-xs w-24 shrink-0 bg-surface-3 border-border/40 rounded-lg"
              />

              <!-- Remove filter -->
              <button
                class="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-error transition-colors shrink-0"
                @click="removeFilter(filter.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </template>

          <!-- Add new filter button -->
          <button
            class="flex items-center gap-1.5 w-full py-2 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
            @click="addNewFilter"
          >
            <Plus class="h-3.5 w-3.5" />
            Add filter
          </button>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 px-3 py-2 border-t border-border/20">
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="cancelFilters">
            Cancel
          </Button>
          <Button size="sm" class="h-7 text-xs" @click="applyFilters"> Apply </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
