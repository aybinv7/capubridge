<script setup lang="ts">
import { computed } from "vue";
import { Spinner } from "@capubridge/cladd";
import type { SearchScope } from "./filesView";

const props = defineProps<{
  loading: boolean;
  error: string;
  needsQuery: boolean;
  scope: SearchScope;
  filtered: boolean;
}>();

const empty = computed(() => {
  if (props.scope === "device") {
    return {
      title: "Nothing on the phone matches",
      detail: "Search looks at names, not contents.",
    };
  }
  if (props.filtered) {
    return { title: "Nothing in this folder matches", detail: "Try Phone to search everywhere." };
  }
  return { title: "This folder is empty", detail: "Hidden files are not shown unless you ask." };
});
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-1.5 px-8 text-center">
    <template v-if="props.loading">
      <Spinner size="sm" />
      <p class="text-xs text-muted-foreground">
        {{ props.scope === "device" ? "Searching the phone" : "Reading the folder" }}
      </p>
    </template>
    <template v-else-if="props.error">
      <p class="text-sm text-foreground">
        {{
          props.scope === "device" ? "The search did not finish." : "This folder could not be read."
        }}
      </p>
      <p class="max-w-md font-mono text-2xs break-all text-error">{{ props.error }}</p>
    </template>
    <template v-else-if="props.needsQuery">
      <p class="text-sm text-foreground">Type a name to search the whole phone</p>
      <p class="max-w-xs text-xs text-muted-foreground">
        Looks through shared storage, app data, temporary files and the system.
      </p>
    </template>
    <template v-else>
      <p class="text-sm text-foreground">{{ empty.title }}</p>
      <p class="max-w-xs text-xs text-muted-foreground">{{ empty.detail }}</p>
    </template>
  </div>
</template>
