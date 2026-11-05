<script setup lang="ts">
import { Plus, X } from "lucide-vue-next";
import { Button, Input } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { MockResponseHeader } from "@/types/mock.types";

const headers = defineModel<MockResponseHeader[]>({ required: true });

function add() {
  headers.value = [...headers.value, { id: crypto.randomUUID(), name: "", value: "" }];
}

function remove(id: string) {
  headers.value = headers.value.filter((header) => header.id !== id);
}

function update(id: string, field: "name" | "value", value: string) {
  headers.value = headers.value.map((header) =>
    header.id === id ? { ...header, [field]: value } : header,
  );
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p v-if="!headers.length" class="text-xs text-muted-foreground">
      Only the content type is sent. Add headers the app expects, such as caching or CORS.
    </p>
    <div v-for="header in headers" :key="header.id" class="flex items-center gap-1.5">
      <Input
        :model-value="header.name"
        size="sm"
        class="min-w-0 flex-1"
        input-class-name="font-mono"
        placeholder="header-name"
        aria-label="Header name"
        @update:model-value="update(header.id, 'name', $event)"
      />
      <Input
        :model-value="header.value"
        size="sm"
        class="min-w-0 flex-[2]"
        input-class-name="font-mono"
        placeholder="value"
        aria-label="Header value"
        @update:model-value="update(header.id, 'value', $event)"
      />
      <IconAction label="Remove header" size="sm" @click="remove(header.id)">
        <X :stroke-width="1.8" />
      </IconAction>
    </div>
    <Button
      size="sm"
      variant="transparent"
      :outline="false"
      content-class-name="gap-1.5"
      class="self-start text-muted-foreground hover:text-foreground"
      @click="add"
    >
      <Plus :size="13" :stroke-width="1.8" aria-hidden="true" />
      Add header
    </Button>
  </div>
</template>
