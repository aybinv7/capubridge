<script setup lang="ts">
import SectionHeader from "@/components/ui/SectionHeader.vue";
import RevealOnScroll from "@/components/ui/RevealOnScroll.vue";
import LayeredCard from "@/components/ui/LayeredCard.vue";
import DiffPreview from "@/components/ui/DiffPreview.vue";
import LanesPreview from "@/components/ui/LanesPreview.vue";
import AgentPreview from "@/components/ui/AgentPreview.vue";

const flagships = [
  {
    id: "diff",
    kicker: "Live diff",
    title: "Watch the data move",
    body: "A change feed across every database at once. Walk through a flow on the phone and see the exact rows a sync or a mutation touched, before and after, at the moment it happens. No refresh, no guessing which write did it.",
    points: [
      "All engines at once, not one store at a time",
      "Before and after on the same row",
      "Lines up with the interaction that caused it",
    ],
    accent: "#5ad39a",
    preview: "diff",
  },
  {
    id: "recording",
    kicker: "Recorded sessions",
    title: "Nobody has to reproduce it again",
    body: "QA hits record, uses the app, and everything lands in one session: the DOM and every interaction, network, console, native logs, performance and the database changes with their diffs. Send the file. The developer opens the exact moment it broke.",
    points: [
      "UI, data and logs on one timeline",
      "Scrub frame by frame, not screenshot by screenshot",
      "Exports as a file you can attach to the ticket",
    ],
    accent: "#8f86ff",
    preview: "lanes",
  },
  {
    id: "mcp",
    kicker: "MCP server",
    title: "An agent that can hold the device",
    body: "The same tools exposed over MCP, so an assistant can do the loop itself: boot an emulator, install the build, drive the UI, read storage and console, take a screenshot, run a benchmark, then compare two scenarios and tell you what differed.",
    points: [
      "Launches emulators and installs builds unattended",
      "Reads storage, console, network and screen",
      "Runs benchmarks and diffs scenarios end to end",
    ],
    accent: "#71cbff",
    preview: "agent",
  },
];
</script>

<template>
  <section
    id="flagships"
    class="pattern-hatch relative mx-auto max-w-[1360px] scroll-mt-20 px-5 py-16 md:px-8 md:py-24"
  >
    <SectionHeader index="04" eyebrow="Only here" title="Three things no browser panel can do." />

    <div class="mt-16 space-y-16 md:space-y-24">
      <RevealOnScroll
        v-for="(item, index) in flagships"
        :key="item.id"
        :delay="60"
        :distance="24"
        class="grid items-center gap-8 md:gap-12 lg:grid-cols-2 lg:gap-16"
        :style="{ '--card-accent': item.accent }"
      >
        <div class="min-w-0" :class="index % 2 === 1 ? 'lg:order-2' : ''">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--card-accent)]">
            {{ item.kicker }}
          </p>
          <h3
            class="mt-4 max-w-[18ch] font-[var(--font-display)] text-[28px] font-semibold leading-[1.04] tracking-[-0.025em] text-[var(--ink-0)] md:text-[38px]"
          >
            {{ item.title }}
          </h3>
          <p class="mt-5 max-w-[52ch] text-[15px] font-normal leading-[1.75] text-[var(--ink-2)]">
            {{ item.body }}
          </p>

          <ul class="mt-7 space-y-3 border-t border-[var(--rule)] pt-6">
            <li
              v-for="point in item.points"
              :key="point"
              class="flex gap-3 text-[13px] leading-[1.6] text-[var(--ink-1)]"
            >
              <span class="mt-[7px] h-px w-4 shrink-0 bg-[var(--card-accent)]" aria-hidden="true" />
              {{ point }}
            </li>
          </ul>
        </div>

        <div class="min-w-0" :class="index % 2 === 1 ? 'lg:order-1' : ''">
          <LayeredCard :accent="item.accent">
            <DiffPreview v-if="item.preview === 'diff'" />
            <LanesPreview v-else-if="item.preview === 'lanes'" />
            <AgentPreview v-else />
          </LayeredCard>
        </div>
      </RevealOnScroll>
    </div>
  </section>
</template>
