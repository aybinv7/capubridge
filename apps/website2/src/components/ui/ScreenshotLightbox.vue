<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { captures } from "@/data/screenshots";

const props = defineProps<{ captureKey: string | null }>();
const emit = defineEmits<{ close: []; step: [delta: number] }>();

const shot = computed(() => (props.captureKey ? captures[props.captureKey] : null));
const isPending = computed(() => shot.value?.status !== "clean");

const onKeydown = (event: KeyboardEvent) => {
  if (!props.captureKey) return;
  if (event.key === "Escape") emit("close");
  if (event.key === "ArrowRight") emit("step", 1);
  if (event.key === "ArrowLeft") emit("step", -1);
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.body.style.removeProperty("overflow");
});

watch(
  () => props.captureKey,
  (key) => {
    document.body.style.overflow = key ? "hidden" : "";
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="shot"
      class="lightbox fixed inset-0 z-[1400] flex items-center justify-center bg-[var(--background)]/92 p-4 backdrop-blur-2xl sm:p-10"
      role="dialog"
      aria-modal="true"
      :aria-label="shot.alt"
      @click.self="emit('close')"
    >
      <button
        type="button"
        class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-md border border-[var(--rule-strong)] text-[var(--ink-1)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] sm:right-8 sm:top-8"
        aria-label="Close"
        @click="emit('close')"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <button
        type="button"
        class="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--rule-strong)] text-[var(--ink-1)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] sm:flex"
        aria-label="Previous screenshot"
        @click.stop="emit('step', -1)"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        class="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--rule-strong)] text-[var(--ink-1)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] sm:flex"
        aria-label="Next screenshot"
        @click.stop="emit('step', 1)"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <figure class="m-0 flex max-h-full w-full max-w-[1100px] flex-col" @click.stop>
        <div
          class="relative w-full overflow-hidden rounded-lg border border-[var(--rule-strong)] bg-[var(--surface-1)]"
          :style="{ viewTransitionName: `shot-${captureKey}`, aspectRatio: '16 / 10' }"
        >
          <div
            class="flex h-8 items-center gap-1.5 border-b border-[var(--rule)] bg-[var(--surface-2)] px-3"
          >
            <span class="h-2 w-2 rounded-full bg-white/15" />
            <span class="h-2 w-2 rounded-full bg-white/10" />
            <span class="h-2 w-2 rounded-full bg-white/10" />
            <span class="ml-2 font-mono text-[10px] tracking-[0.1em] text-[var(--ink-3)]">
              capubridge
            </span>
          </div>

          <img
            v-if="!isPending"
            :src="shot.src"
            :srcset="shot.srcset"
            sizes="(min-width: 640px) 90vw, 100vw"
            :alt="shot.alt"
            class="h-[calc(100%-2rem)] w-full object-contain"
            decoding="async"
          />
          <div
            v-else
            class="flex h-[calc(100%-2rem)] flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
              Capture pending
            </p>
            <p class="max-w-[40ch] text-[12px] leading-5 text-[var(--ink-3)]">
              {{ shot.blocker }} — needs a recapture against the demo app before this ships.
            </p>
          </div>
        </div>

        <figcaption class="mt-4 flex gap-3 text-[13px] leading-6 text-[var(--ink-2)]">
          <span class="mt-[9px] h-px w-6 shrink-0 bg-[var(--rule-strong)]" aria-hidden="true" />
          {{ shot.caption }}
        </figcaption>
      </figure>
    </div>
  </Teleport>
</template>
