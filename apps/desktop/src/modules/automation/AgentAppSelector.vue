<script setup lang="ts">
import { Check, ChevronsUpDown, Package } from "lucide-vue-next";
import type { AgentAppPackage } from "./useInstalledPackages";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const props = defineProps<{
  modelValue: string;
  packages: AgentAppPackage[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const open = ref(false);
const sortedPackages = computed(() =>
  [...props.packages].sort((left, right) => left.label.localeCompare(right.label)),
);
const selectedPackage = computed(
  () => props.packages.find((entry) => entry.packageName === props.modelValue) ?? null,
);
const selectedLabel = computed(
  () => selectedPackage.value?.label ?? (props.modelValue || "Choose an installed app"),
);

function selectPackage(packageName: string): void {
  emit("update:modelValue", packageName);
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        role="combobox"
        :disabled="disabled"
        class="h-7 max-w-64 justify-between gap-2 px-2 text-xs font-normal text-muted-foreground"
      >
        <span class="flex min-w-0 items-center gap-1.5">
          <Package class="size-3.5 shrink-0" />
          <span class="truncate">{{ selectedLabel }}</span>
        </span>
        <ChevronsUpDown class="size-3.5 shrink-0 opacity-60" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-80 p-0" align="start">
      <Command>
        <CommandInput placeholder="Search installed apps" />
        <CommandList>
          <CommandEmpty>No cached third-party apps.</CommandEmpty>
          <CommandGroup heading="Installed apps">
            <CommandItem
              v-for="packageName in sortedPackages"
              :key="packageName.packageName"
              :value="packageName.packageName"
              @select="selectPackage(packageName.packageName)"
            >
              <img
                v-if="packageName.iconPath !== null"
                :src="packageName.iconPath"
                :alt="`${packageName.label} icon`"
                class="size-4 rounded-sm object-cover"
              />
              <Package v-else class="size-4" />
              <span class="min-w-0 flex-1 truncate">{{ packageName.label }}</span>
              <span class="max-w-32 truncate text-xs text-muted-foreground">{{
                packageName.packageName
              }}</span>
              <Check v-if="packageName.packageName === modelValue" class="size-4" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
