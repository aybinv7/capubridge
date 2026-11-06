<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { Check, Copy } from "lucide-vue-next";
import { toast } from "@/lib/toast";
import IconAction from "@/shared/components/presentation/IconAction.vue";

const props = defineProps<{ value: string; label: string }>();

const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(resetTimer));

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied.value = false;
    }, 1200);
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}
</script>

<template>
  <IconAction :label="copied ? 'Copied' : props.label" size="sm" @click="copy">
    <Check v-if="copied" :stroke-width="2" />
    <Copy v-else :stroke-width="1.8" />
  </IconAction>
</template>
