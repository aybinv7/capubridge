<script setup lang="ts">
import {
  AccordionIndicator,
  AccordionItem,
  AccordionPanel,
  AccordionRoot,
  AccordionTrigger,
  Surface,
} from "@capubridge/ui";
import { ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";

defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const headerClass =
  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-cui-sm text-cui-fg hover:bg-cui-surface-hover data-[disabled]:opacity-50";

const items = [
  { value: "appearance", label: "Appearance", body: "Theme, accent color, density." },
  { value: "layout", label: "Layout", body: "Grid, spacing, breakpoints." },
  { value: "advanced", label: "Advanced", body: "Feature flags and experiments." },
] as const;

const open = ref<string[]>(["appearance"]);

const accordionCode = `<AccordionRoot default-value="appearance" multiple>
  <AccordionItem v-for="item in items" :key="item.value" :value="item.value">
    <AccordionTrigger>
      <button class="${headerClass}">
        {{ item.label }}
        <AccordionIndicator class="size-4 -rotate-90 text-cui-fg-soft transition-transform duration-200 data-[open]:rotate-0">
          <ChevronDownIcon />
        </AccordionIndicator>
      </button>
    </AccordionTrigger>
    <AccordionPanel>
      <div class="px-3 pt-1 pb-3 text-cui-sm text-cui-fg-soft">{{ item.body }}</div>
    </AccordionPanel>
  </AccordionItem>
</AccordionRoot>`;
</script>

<template>
  <CatalogSection
    description="Disclosure groups built on CollapsibleRoot/Trigger/Panel/Indicator — AccordionTrigger, AccordionPanel and AccordionIndicator are the very same components under an Accordion-flavored name."
    eyebrow="07 · Navigation"
    id="accordion"
    title="Accordion"
  >
    <ComponentPlayground :code="accordionCode">
      <template #preview>
        <div class="accordion-section__row">
          <Surface
            class="accordion-section__card"
            content-class-name="accordion-section__list"
            outline
            wrap-content
          >
            <AccordionRoot default-value="appearance" multiple>
              <AccordionItem v-for="item in items" :key="item.value" :value="item.value">
                <AccordionTrigger>
                  <button :class="headerClass" :disabled="!interactionsEnabled">
                    {{ item.label }}
                    <AccordionIndicator class="accordion-section__chevron">
                      <svg
                        class="size-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                      >
                        <path d="m4 6 4 4 4-4" />
                      </svg>
                    </AccordionIndicator>
                  </button>
                </AccordionTrigger>
                <AccordionPanel>
                  <div class="accordion-section__body">{{ item.body }}</div>
                </AccordionPanel>
              </AccordionItem>
            </AccordionRoot>
          </Surface>

          <Surface
            class="accordion-section__card"
            content-class-name="accordion-section__list"
            outline
            wrap-content
          >
            <AccordionRoot multiple :value="open" @update:value="open = $event as string[]">
              <AccordionItem
                v-for="item in items"
                :key="item.value"
                :disabled="item.value === 'advanced'"
                :value="item.value"
              >
                <AccordionTrigger>
                  <button :class="headerClass" :disabled="!interactionsEnabled">
                    {{ item.label }}
                    <AccordionIndicator class="accordion-section__chevron">
                      <svg
                        class="size-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                      >
                        <path d="m4 6 4 4 4-4" />
                      </svg>
                    </AccordionIndicator>
                  </button>
                </AccordionTrigger>
                <AccordionPanel>
                  <div class="accordion-section__body">{{ item.body }}</div>
                </AccordionPanel>
              </AccordionItem>
            </AccordionRoot>
          </Surface>
        </div>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>

<style scoped>
.accordion-section__row {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  align-items: flex-start;
}

.accordion-section__card {
  width: 288px;
  overflow: hidden;
  border-radius: 24px;
}

.accordion-section__list {
  display: flex;
  flex-direction: column;
}

.accordion-section__list > :not(:last-child) {
  border-bottom: 1px solid var(--cui-outline);
}

.accordion-section__chevron {
  flex-shrink: 0;
  color: var(--cui-fg-soft);
  transform: rotate(-90deg);
  transition: transform 0.2s ease-out;
}

.accordion-section__chevron[data-open] {
  transform: rotate(0deg);
}

.accordion-section__body {
  padding: 4px 12px 12px;
  color: var(--cui-fg-soft);
  font-size: 12px;
}
</style>
