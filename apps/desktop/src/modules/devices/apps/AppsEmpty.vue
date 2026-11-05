<script setup lang="ts">
import { computed } from "vue";
import type { AppScope } from "./appsModel";

const props = defineProps<{ searching: boolean; scope: AppScope }>();

const copy = computed(() => {
  if (props.searching) {
    return {
      title: "No app matches the search",
      detail:
        props.scope === "all"
          ? "Check the spelling, or search by package name."
          : "Check the spelling, or look in All apps.",
    };
  }
  if (props.scope === "third-party") {
    return {
      title: "Nothing installed yet",
      detail: "Apps you install on the phone, including debug builds, show up here.",
    };
  }
  return { title: "No apps in this list", detail: "Reload the list if you expected some." };
});
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-1 px-8 text-center">
    <p class="text-sm text-foreground">{{ copy.title }}</p>
    <p class="max-w-72 text-xs text-muted-foreground">{{ copy.detail }}</p>
  </div>
</template>
