<script setup lang="ts">
import { computed, ref } from "vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import RevealOnScroll from "@/components/ui/RevealOnScroll.vue";
import AppFrame from "@/components/ui/AppFrame.vue";
import ScreenshotLightbox from "@/components/ui/ScreenshotLightbox.vue";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { useScrollSequence } from "@/composables/useScrollSequence";
import { captures } from "@/data/screenshots";
import { features } from "@/data/features";

/** Viewport heights of scroll spent on each step while the stage is pinned. */
const STEP_VH = 46;

/**
 * Branch on the query rather than on `hidden lg:block`, so the pinned rail's
 * ten extra frames are absent from the phone's DOM instead of merely
 * invisible in it.
 */
const isDesktop = useMediaQuery("(min-width: 1024px)");

const track = ref<HTMLElement | null>(null);
const { progress } = useScrollSequence(track);
const lightboxKey = ref<string | null>(null);

const raw = computed(() => progress.value * features.length);
const activeIndex = computed(() =>
  Math.min(features.length - 1, Math.max(0, Math.floor(raw.value))),
);
const active = computed(() => features[activeIndex.value]);

const stepProgress = (index: number) => Math.min(1, Math.max(0, raw.value - index));

const goTo = (index: number) => {
  const el = track.value;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  if (travel <= 0) return;

  const sectionTop = rect.top + window.scrollY;
  window.scrollTo({
    top: sectionTop + travel * ((index + 0.35) / features.length),
    behavior: "auto",
  });
};

const openLightbox = (key: string) => {
  if (captures[key]?.status === "clean") lightboxKey.value = key;
};
</script>

<template>
  <section id="capabilities" class="pattern-dots relative scroll-mt-20 pt-16">
    <!-- <div class="mx-auto max-w-[1360px] px-5 pt-16 md:px-8 md:pt-24">
      <SectionHeader
        index="03"
        eyebrow="Capabilities"
        title="Ten panels that never lose the device."
        lede="Each one speaks the protocol directly - ADB for the device, CDP for the WebView - so nothing you read is a guess and nothing you write is faked locally."
      />
    </div> -->

    <!--
      Desktop: the stage pins and the rail advances with the scroll, so the
      screenshots play through as you move down the page.
    -->
    <div
      v-if="isDesktop"
      ref="track"
      class="relative mt-10"
      :style="{ height: `${features.length * STEP_VH + 40}vh` }"
    >
      <div class="sticky top-8 flex h-screen items-center">
        <div
          class="mx-auto grid h-full w-full max-w-[1600px] grid-cols-[minmax(0,14rem)_1fr] items-center gap-10 px-8 py-12 xl:gap-14"
        >
          <ol class="flex flex-col gap-px">
            <li v-for="(feature, index) in features" :key="feature.key">
              <button
                type="button"
                class="rail-item relative flex w-full flex-col py-2 pl-4 text-left"
                :class="index === activeIndex ? 'is-active' : ''"
                :style="{ '--card-accent': feature.accent }"
                :aria-current="index === activeIndex ? 'true' : undefined"
                @click="goTo(index)"
              >
                <span class="rail-track" aria-hidden="true">
                  <span
                    class="rail-fill"
                    :style="{ transform: `scaleY(${stepProgress(index)})` }"
                  />
                </span>

                <span class="flex items-baseline gap-3">
                  <span
                    class="font-mono text-[10px] tabular-nums tracking-[0.16em] text-[var(--ink-3)]"
                  >
                    {{ String(index + 1).padStart(2, "0") }}
                  </span>
                  <span class="rail-label text-[14px] font-medium leading-tight">
                    {{ feature.label }}
                  </span>
                </span>

                <span class="rail-value">
                  <span class="overflow-hidden">
                    <span
                      class="block pl-[1.85rem] pt-1 text-[11px] leading-[1.45] text-[var(--ink-2)]"
                    >
                      {{ feature.value }}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          </ol>

          <div v-if="active" class="h-full min-h-0" :style="{ '--card-accent': active.accent }">
            <div class="flex h-full min-h-0 flex-col">
              <!--
                All frames stay mounted and crossfade, so scrubbing through the
                rail never remounts an image or thrashes the layout.
              -->

              <div class="relative min-h-0 flex-1">
                <button
                  v-for="(feature, index) in features"
                  :key="feature.key"
                  type="button"
                  class="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
                  :class="index === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'"
                  :tabindex="index === activeIndex ? 0 : -1"
                  :aria-hidden="index !== activeIndex"
                  :aria-label="`Enlarge ${feature.label} screenshot`"
                  @click="openLightbox(feature.capture)"
                >
                  <AppFrame
                    :capture="feature.capture"
                    ratio="1.88 / 1"
                    fill
                    :crop="false"
                    :show-caption="false"
                    :view-transition-name="
                      lightboxKey === feature.capture ? undefined : `shot-${feature.capture}`
                    "
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!--
      Below lg a pinned stage fights touch scrolling, so the steps become a
      horizontal, swipeable carousel instead - one card per capability,
      snapped, with the page scroll left untouched.
    -->
    <div v-else>
      <RevealOnScroll :distance="20" class="mt-10">
        <div
          class="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:px-8"
        >
          <article
            v-for="(feature, index) in features"
            :key="feature.key"
            class="w-[82vw] shrink-0 snap-start sm:w-[420px]"
            :style="{ '--card-accent': feature.accent }"
          >
            <button
              type="button"
              class="block w-full text-left"
              @click="openLightbox(feature.capture)"
            >
              <AppFrame
                :capture="feature.capture"
                ratio="1.9 / 1"
                :crop="false"
                :show-caption="false"
              />
            </button>

            <p
              class="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--card-accent)]"
            >
              {{ String(index + 1).padStart(2, "0") }} · {{ feature.label }}
            </p>
            <h3
              class="mt-3 font-[var(--font-display)] text-[22px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--ink-0)]"
            >
              {{ feature.title }}
            </h3>
            <p class="mt-2.5 text-[14px] font-normal leading-[1.7] text-[var(--ink-2)]">
              {{ feature.body }}
            </p>
          </article>
        </div>
      </RevealOnScroll>
    </div>

    <ScreenshotLightbox :capture-key="lightboxKey" @close="lightboxKey = null" @step="() => {}" />
  </section>
</template>

<style scoped>
.rail-item {
  color: var(--ink-3);
  transition: color 260ms ease;
}

.rail-item:hover,
.rail-item.is-active {
  color: var(--ink-0);
}

.rail-track {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 1px;
  background: var(--rule);
}

.rail-fill {
  position: absolute;
  inset: 0;
  transform-origin: top;
  background: var(--card-accent);
  transition: transform 120ms linear;
}

.rail-label {
  color: inherit;
}

.rail-value {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 340ms cubic-bezier(0.22, 1, 0.36, 1);
}

.rail-item.is-active .rail-value {
  grid-template-rows: 1fr;
}

.rail-value > span {
  min-height: 0;
}

.rail-item.is-active .rail-label {
  color: var(--ink-0);
}
</style>
