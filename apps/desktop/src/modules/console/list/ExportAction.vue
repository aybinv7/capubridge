<script setup lang="ts">
import { ref } from "vue";
import { Download } from "lucide-vue-next";
import { Button, Popover } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";

/** One file format the view can save, with a plain description. */
export interface ExportChoice {
  id: string;
  label: string;
  detail: string;
}

/** The save action: picks a format, then the view asks where to save. */
const props = defineProps<{ label: string; choices: readonly ExportChoice[]; busy?: boolean }>();
const emit = defineEmits<{ export: [id: string] }>();

const open = ref(false);
const anchor = ref<HTMLElement | null>(null);

function choose(id: string) {
  open.value = false;
  emit("export", id);
}
</script>

<template>
  <span ref="anchor" class="inline-flex">
    <IconAction
      :label="props.label"
      hint="Saves what the query keeps"
      :pressed="open"
      :loading="props.busy"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Download :stroke-width="1.8" />
    </IconAction>
  </span>
  <Popover
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="bottom-end"
    :offset="6"
    class="w-60"
    content-class-name="w-full p-1"
    :aria-label="props.label"
  >
    <div class="flex flex-col">
      <Button
        v-for="choice in props.choices"
        :key="choice.id"
        size="sm"
        variant="transparent"
        :outline="false"
        class="h-auto justify-start py-1.5"
        content-class-name="flex-col items-start gap-0.5"
        @click="choose(choice.id)"
      >
        <span class="text-xs text-foreground">{{ choice.label }}</span>
        <span class="text-2xs font-normal text-[var(--fg-subtle)]">{{ choice.detail }}</span>
      </Button>
    </div>
  </Popover>
</template>
