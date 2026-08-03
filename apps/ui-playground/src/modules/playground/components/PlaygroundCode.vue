<script setup lang="ts">
import { Button, Surface } from "@capubridge/ui";
import { onBeforeUnmount, ref, watch } from "vue";

import CheckIcon from "./icons/CheckIcon.vue";
import CopyIcon from "./icons/CopyIcon.vue";
import PlaygroundToolbar from "./PlaygroundToolbar.vue";

const props = defineProps<{
  code: string;
}>();

const collapsed = ref(true);
const highlighted = ref<string>();
const copyState = ref<"idle" | "copied" | "failed">("idle");
let highlightRequest = 0;
let copyTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.code,
  async (code) => {
    const request = ++highlightRequest;
    highlighted.value = undefined;
    try {
      const { codeToHtml } = await import("shiki");
      const html = await codeToHtml(code, {
        defaultColor: false,
        lang: "vue",
        themes: { dark: "github-dark", light: "github-light" },
        transformers: [
          {
            code(node) {
              node.children = node.children.filter(
                (child) => child.type !== "text" || child.value.trim() !== "",
              );
            },
            line(node) {
              node.properties["data-line"] = "";
            },
            pre(node) {
              delete node.properties.style;
              delete node.properties.tabindex;
            },
          },
        ],
      });
      if (request === highlightRequest) highlighted.value = html;
    } catch {
      if (request === highlightRequest) highlighted.value = undefined;
    }
  },
  { immediate: true },
);

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.code);
    copyState.value = "copied";
  } catch {
    copyState.value = "failed";
  }
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copyState.value = "idle";
  }, 1000);
}

onBeforeUnmount(() => {
  highlightRequest += 1;
  if (copyTimer) clearTimeout(copyTimer);
});
</script>

<template>
  <Surface
    class="example-code"
    :class="{ 'example-code--expanded': !collapsed }"
    :outline="!collapsed"
    :wrap-content="false"
  >
    <div class="example-code__viewport" :class="{ 'example-code__viewport--collapsed': collapsed }">
      <div v-if="highlighted" class="example-code__highlight" tabindex="-1" v-html="highlighted" />
      <pre v-else tabindex="-1"><code>{{ props.code }}</code></pre>
    </div>

    <PlaygroundToolbar v-if="collapsed" class="example-code__reveal" :surface-level="3">
      <Button rounded @click="collapsed = false">View Code</Button>
    </PlaygroundToolbar>

    <Button
      v-else
      :aria-label="
        copyState === 'copied'
          ? 'Copied'
          : copyState === 'failed'
            ? 'Copy unavailable'
            : 'Copy code'
      "
      class="example-code__copy"
      :outline="false"
      rounded
      variant="transparent"
      @click="copyCode"
    >
      <CheckIcon v-if="copyState === 'copied'" />
      <CopyIcon v-else />
    </Button>
  </Surface>
</template>
