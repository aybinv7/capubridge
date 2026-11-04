<script setup lang="ts">
import { computed } from "vue";
import { MonitorOff, RotateCw } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import { describeMirrorError, type MirrorPhase } from "./mirrorStatus";

const props = withDefaults(
  defineProps<{
    phase: MirrorPhase;
    error: string | null;
    detached?: boolean;
  }>(),
  { detached: false },
);

const emit = defineEmits<{ restart: [] }>();

const errorCopy = computed(() => (props.error ? describeMirrorError(props.error) : null));
</script>

<template>
  <div
    v-if="props.detached"
    class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-5 text-center"
  >
    <p class="text-xs text-muted-foreground">The screen is open in its own window</p>
    <p class="text-2xs text-[var(--fg-subtle)]">Close that window to bring it back here.</p>
  </div>

  <div
    v-else-if="errorCopy"
    class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center"
    role="alert"
  >
    <MonitorOff :size="22" :stroke-width="1.6" class="mb-1 text-error" />
    <p class="text-sm font-medium text-foreground">{{ errorCopy.title }}</p>
    <p class="text-xs text-muted-foreground">{{ errorCopy.hint }}</p>
    <p
      class="line-clamp-3 max-w-full font-mono text-2xs break-words text-[var(--fg-subtle)]"
      :title="errorCopy.detail"
    >
      {{ errorCopy.detail }}
    </p>
    <Button
      variant="solid"
      surface-level="+2"
      size="sm"
      class="mt-2"
      content-class-name="gap-1.5 px-3 [&>svg]:size-3.5"
      @click.stop="emit('restart')"
      @mousedown.stop
      @keydown.stop
    >
      <RotateCw :stroke-width="1.8" />
      Restart the stream
    </Button>
  </div>

  <div
    v-else-if="props.phase === 'starting' || props.phase === 'waiting'"
    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-5 text-center"
    aria-live="polite"
  >
    <Spinner size="sm" class="text-[var(--fg-subtle)]" />
    <p class="text-xs text-muted-foreground">
      {{ props.phase === "starting" ? "Starting the screen" : "Waiting for the first frame" }}
    </p>
    <p v-if="props.phase === 'waiting'" class="text-2xs text-[var(--fg-subtle)]">
      A locked or sleeping device sends nothing until it wakes.
    </p>
  </div>

  <div
    v-else-if="props.phase === 'off'"
    class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center"
  >
    <p class="text-xs text-muted-foreground">No stream running</p>
    <Button
      variant="transparent"
      size="sm"
      content-class-name="gap-1.5 px-3 [&>svg]:size-3.5"
      @click.stop="emit('restart')"
      @mousedown.stop
      @keydown.stop
    >
      <RotateCw :stroke-width="1.8" />
      Start the stream
    </Button>
  </div>
</template>
