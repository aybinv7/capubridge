<script setup lang="ts">
import { ChevronDown, Plus } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_RULE_TEMPLATES, type MockRule } from "@/types/mock.types";

const emit = defineEmits<{ create: [template?: Partial<MockRule>] }>();
</script>

<template>
  <span class="flex shrink-0 items-center">
    <Button
      size="sm"
      variant="solid-fill"
      content-class-name="gap-1.5"
      class="rounded-r-none"
      @click="emit('create')"
    >
      <Plus :size="13" :stroke-width="2" aria-hidden="true" />
      New rule
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          size="sm"
          variant="solid-fill"
          square
          aria-label="New rule from a template"
          class="rounded-l-none border-l border-background/20"
        >
          <ChevronDown :size="13" :stroke-width="2" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-48">
        <DropdownMenuLabel>Start from</DropdownMenuLabel>
        <DropdownMenuItem
          v-for="template in DEFAULT_RULE_TEMPLATES"
          :key="template.label"
          @select="emit('create', template.rule)"
        >
          {{ template.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
