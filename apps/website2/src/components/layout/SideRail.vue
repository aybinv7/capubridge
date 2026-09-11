<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { sectionMarks } from "@/data/site";

const activeId = ref(sectionMarks[0].id);
/** Only mark sections that are actually on the page, so a removed section
 *  never leaves a tick that scrolls nowhere. */
const marks = ref([...sectionMarks]);
let observer: IntersectionObserver | undefined;

const active = computed(
  () => sectionMarks.find((mark) => mark.id === activeId.value) ?? sectionMarks[0],
);
const activeIndex = computed(() => sectionMarks.findIndex((mark) => mark.id === activeId.value));

onMounted(() => {
  marks.value = sectionMarks.filter((mark) => document.getElementById(mark.id));

  observer = new IntersectionObserver(
    (entries) => {
      const best = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (best) activeId.value = best.target.id;
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.2, 0.6] },
  );

  for (const mark of marks.value) {
    const el = document.getElementById(mark.id);
    if (el) observer.observe(el);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <nav
    class="fixed left-0 top-0 z-[1140] hidden h-full w-8 flex-col items-center lg:flex"
    aria-label="Section rail"
  >
    <span class="w-px flex-1 bg-[var(--rule)]" aria-hidden="true" />

    <ol class="flex flex-col gap-1 py-4">
      <li v-for="(mark, index) in marks" :key="mark.id">
        <a
          :href="`#${mark.id}`"
          class="tick-hit flex h-4 w-8 items-center justify-center"
          :aria-current="index === activeIndex ? 'true' : undefined"
        >
          <span class="tick block h-px" :class="index === activeIndex ? 'is-active' : ''" />
          <span class="sr-only">{{ mark.index }} — {{ mark.label }}</span>
        </a>
      </li>
    </ol>

    <span class="w-px flex-1 bg-[var(--rule)]" aria-hidden="true" />

    <!--
      Fixed height regardless of label length, so a longer/shorter section
      name never redistributes the flex-1 spacers above and shifts the tick
      ladder. The longest label ("The broken workflow") sets the budget.
    -->
    <div class="flex h-[300px] items-center justify-center overflow-hidden">
      <p
        class="pointer-events-none font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-3)] [writing-mode:vertical-rl]"
      >
        <span class="text-[var(--accent)]">{{ active.index }}</span>
        <span class="my-2 inline-block" aria-hidden="true">/</span>
        <span>{{ active.label }}</span>
      </p>
    </div>

    <span class="h-10 w-px bg-[var(--rule)]" aria-hidden="true" />
  </nav>
</template>

<style scoped>
.tick {
  width: 10px;
  background: var(--rule-strong);
  transition:
    width 300ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 240ms ease,
    box-shadow 240ms ease;
}

.tick-hit:hover .tick {
  width: 18px;
  background: var(--ink-2);
}

.tick.is-active {
  width: 22px;
  background: var(--accent);
  box-shadow: 0 0 10px rgba(232, 118, 90, 0.7);
}
</style>
