<script setup lang="ts">
import { Dialog } from "@capubridge/cladd";
import MockBodyEditor from "./MockBodyEditor.vue";

const open = defineModel<boolean>("open", { required: true });
const body = defineModel<string>("body", { required: true });

const props = defineProps<{ json: boolean; ruleName: string }>();
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :title="`Response body · ${props.ruleName}`"
    class="h-[calc(100vh-96px)] w-[calc(100vw-96px)] max-w-5xl"
    content-class-name="flex h-full min-h-0 flex-col gap-3 p-4"
  >
    <div class="min-h-0 flex-1">
      <MockBodyEditor
        v-model="body"
        :json="props.json"
        :label="`Response body of ${props.ruleName}`"
      />
    </div>
  </Dialog>
</template>
