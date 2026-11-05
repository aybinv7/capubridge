<script setup lang="ts">
import { AppWindow } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { useUIStore } from "@/stores/ui.store";

const props = defineProps<{ reported: string | null }>();

const ui = useUIStore();
</script>

<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="flex max-w-sm flex-col items-center gap-3 text-center" role="status">
      <AppWindow
        :size="22"
        :stroke-width="1.6"
        class="text-[var(--fg-subtle)]"
        aria-hidden="true"
      />
      <p class="text-sm font-medium text-foreground">This WebView does not name its app</p>
      <p class="text-xs text-muted-foreground">
        The phone did not say which installed app owns it, so there is nothing to read or start.
        Pick a WebView that belongs to an app.
      </p>
      <p v-if="props.reported" class="font-mono text-2xs text-[var(--fg-subtle)]">
        Reported as “{{ props.reported }}”
      </p>
      <Button size="sm" variant="transparent" @click="ui.openDeviceManager()">
        Choose another WebView
      </Button>
    </div>
  </div>
</template>
