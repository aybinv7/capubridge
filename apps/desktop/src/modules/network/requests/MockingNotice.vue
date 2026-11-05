<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Button, StatusDot, Tooltip } from "@capubridge/cladd";
import { useMockStore } from "../stores/useMockStore";

const router = useRouter();
const mock = useMockStore();

const available = router.hasRoute("network-mock");
const active = computed(() => available && mock.interceptMode !== "off" && mock.enabledCount > 0);
const label = computed(
  () => `Mocking ${mock.enabledCount} ${mock.enabledCount === 1 ? "rule" : "rules"}`,
);
const detail = computed(() =>
  mock.interceptMode === "cdp"
    ? "Matching requests in this WebView get answers from your rules, not the server"
    : "The local mock server answers requests sent to it",
);
</script>

<template>
  <Tooltip
    v-if="active"
    position="bottom"
    :offset="6"
    content-class-name="max-w-72 px-2 py-1 text-xs"
  >
    <template #trigger>
      <Button
        size="sm"
        variant="transparent"
        :outline="false"
        content-class-name="gap-1.5"
        class="shrink-0 text-muted-foreground hover:text-foreground"
        @click="router.push({ name: 'network-mock' })"
      >
        <StatusDot color="cyan" />
        {{ label }}
      </Button>
    </template>
    {{ detail }}
  </Tooltip>
</template>
