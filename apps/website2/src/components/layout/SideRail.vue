<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { sectionMarks } from "@/data/site";

const activeId = ref(sectionMarks[0].id);
/** Only mark sections that are actually on the page, so a removed section
 *  never leaves a row that scrolls nowhere. */
const marks = ref([...sectionMarks]);
let observer: IntersectionObserver | undefined;

const activeIndex = computed(() => marks.value.findIndex((mark) => mark.id === activeId.value));

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
  <!--
    Collapsed to the container gutter at rest and expanded on hover. A
    permanently labelled rail needs ~240px; at 1440 the gutter beside a
    1360px container is 72px, so always-open would sit on top of the text.
    Wide screens do have the room, and open by default there.
  -->
  <nav
    class="rail fixed left-0 top-0 z-[1140] hidden h-full items-center lg:flex"
    aria-label="Sections"
  >
    <div class="rail-scrim" aria-hidden="true" />

    <ol class="relative flex flex-col py-4">
      <li v-for="(mark, index) in marks" :key="mark.id" class="rail-item">
        <a
          :href="`#${mark.id}`"
          class="row"
          :class="index === activeIndex ? 'is-active' : ''"
          :aria-current="index === activeIndex ? 'true' : undefined"
        >
          <span class="row-line" aria-hidden="true" />
          <span class="row-num font-mono text-[10px] tabular-nums tracking-[0.14em]">
            {{ mark.index }}
          </span>
          <span class="row-label font-[var(--font-display)] text-[15px] font-medium">
            {{ mark.label }}
          </span>
        </a>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.rail {
  --rail-collapsed: 2rem;
  --rail-open: 15rem;

  width: var(--rail-collapsed);
  /*
   * Rows are nowrap and wider than the collapsed rail. Without clipping they
   * stay hoverable and clickable out over the page, stealing pointer events
   * from content near the left edge while being invisible.
   */
  overflow: hidden;
  transition: width 380ms cubic-bezier(0.22, 1, 0.36, 1);
}

.rail:hover,
.rail:focus-within {
  width: var(--rail-open);
}

/* Only paints while open, so labels stay legible over the page. */
.rail-scrim {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: linear-gradient(90deg, var(--background) 55%, transparent);
  transition: opacity 380ms ease;
  pointer-events: none;
}

.rail:hover .rail-scrim,
.rail:focus-within .rail-scrim {
  opacity: 0.92;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0;
  padding-left: 0.5rem;
  color: var(--ink-3);
  white-space: nowrap;
  transition: color 240ms ease;
}

/* The measuring-scale tick between rows. */
.rail-item + .rail-item::before {
  display: block;
  width: 10px;
  height: 1px;
  margin-left: 0.5rem;
  background: var(--rule);
  content: "";
}

.row-line {
  width: 16px;
  height: 1px;
  flex: none;
  background: var(--rule-strong);
  transition:
    width 320ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 240ms ease,
    box-shadow 240ms ease;
}

.row:hover .row-line {
  width: 24px;
  background: var(--ink-2);
}

.row.is-active .row-line {
  width: 30px;
  background: var(--accent);
  box-shadow: 0 0 10px rgb(232 118 90 / 0.7);
}

.row-num {
  flex: none;
  opacity: 0;
  transition:
    opacity 260ms ease,
    color 240ms ease;
}

.row.is-active .row-num {
  color: var(--accent);
}

.row-label {
  opacity: 0;
  transform: translateX(-6px);
  transition:
    opacity 300ms ease,
    transform 380ms cubic-bezier(0.22, 1, 0.36, 1),
    color 240ms ease;
}

.row:hover .row-label,
.row.is-active .row-label {
  color: var(--ink-0);
}

.rail:hover .row-num,
.rail:focus-within .row-num,
.rail:hover .row-label,
.rail:focus-within .row-label {
  opacity: 1;
  transform: translateX(0);
}

.rail:hover .row-label,
.rail:focus-within .row-label {
  color: var(--ink-2);
}

.rail:hover .row.is-active .row-label,
.rail:focus-within .row.is-active .row-label {
  color: var(--ink-0);
}

/*
 * Past this width the gutter beside the container is wide enough to hold the
 * open rail without touching the text, so it simply stays open.
 */
@media (min-width: 1800px) {
  .rail {
    width: var(--rail-open);
  }

  .row-num,
  .row-label {
    opacity: 1;
    transform: translateX(0);
  }

  .rail-scrim {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rail,
  .row-line,
  .row-num,
  .row-label,
  .rail-scrim {
    transition-duration: 1ms;
  }
}
</style>
