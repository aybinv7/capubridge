<script setup lang="ts">
import { Checkbox } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundColorControl from "../components/PlaygroundColorControl.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const choiceSizes = ["xs", "sm", "md"] as const;
type ChoiceSize = (typeof choiceSizes)[number];

const size = ref<ChoiceSize>("md");
const color = ref<UiAccent>("brand");
const checked = ref(true);
const disabled = ref(false);
const readOnly = ref(false);
const required = ref(false);
const thumbOutline = ref(true);
const hoverable = ref(true);
const focusable = ref(true);
const nativeInput = ref(true);

const formLogs = ref(true);
const formTraces = ref(false);
const changeLog = ref<string[]>([]);
const submitted = ref<string[][]>([]);

const code = computed(
  () => `<Checkbox
  v-model="checked"
  size="${size.value}"
  color="${color.value}"
  :disabled="${disabled.value}"
  :read-only="${readOnly.value}"
  :required="${required.value}"
  :thumb-outline="${thumbOutline.value}"
  :hoverable="${hoverable.value}"
  :focusable="${focusable.value}"
  :input="${nativeInput.value}"
  name="verbose"
  value="yes"
  @change="onChange"
/>`,
);

function onChange(next: boolean): void {
  changeLog.value = [`change → ${next}`, ...changeLog.value].slice(0, 4);
}

function onSubmit(event: Event): void {
  const form = event.target as HTMLFormElement;
  submitted.value = [...new FormData(form).entries()].map(([key, value]) => [key, String(value)]);
}
</script>

<template>
  <CatalogSection
    description="Every checkbox contract: the three choice sizes, controlled and uncontrolled state, the input-less fallback, native form participation, and each interaction guard."
    eyebrow="04 · Forms"
    id="checkbox"
    title="Checkbox"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <Checkbox
          v-model="checked"
          :color="color"
          :disabled="disabled || !props.interactionsEnabled"
          :focusable="focusable"
          :hoverable="hoverable"
          :input="nativeInput"
          name="verbose"
          :read-only="readOnly"
          :required="required"
          :size="size"
          :thumb-outline="thumbOutline"
          value="yes"
          @change="onChange"
        />
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="size" :items="choiceSizes" label="Checkbox size" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="checked" label="checked" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="disabled" label="disabled" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="readOnly" label="readOnly" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="required" label="required" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="thumbOutline" label="thumbOutline" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="hoverable" label="hoverable" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="focusable" label="focusable" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="nativeInput" label="input" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundColorControl v-model="color" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>

    <div class="checkbox-grid">
      <section class="checkbox-grid__panel">
        <h3 class="checkbox-grid__title">Sizes</h3>
        <div class="checkbox-grid__row">
          <label v-for="entry in choiceSizes" :key="entry" class="checkbox-grid__item">
            <Checkbox :checked="true" :color="color" :size="entry" />
            <span class="checkbox-grid__label">{{ entry }}</span>
          </label>
        </div>
      </section>

      <section class="checkbox-grid__panel">
        <h3 class="checkbox-grid__title">States</h3>
        <div class="checkbox-grid__row">
          <label class="checkbox-grid__item">
            <Checkbox :color="color" />
            <span class="checkbox-grid__label">unchecked</span>
          </label>
          <label class="checkbox-grid__item">
            <Checkbox :checked="true" :color="color" />
            <span class="checkbox-grid__label">checked</span>
          </label>
          <label class="checkbox-grid__item">
            <Checkbox :checked="true" :color="color" disabled />
            <span class="checkbox-grid__label">disabled</span>
          </label>
          <label class="checkbox-grid__item">
            <Checkbox :checked="true" :color="color" read-only />
            <span class="checkbox-grid__label">readOnly</span>
          </label>
          <label class="checkbox-grid__item">
            <Checkbox :checked="true" :color="color" :thumb-outline="false" />
            <span class="checkbox-grid__label">no outline</span>
          </label>
          <label class="checkbox-grid__item">
            <Checkbox :checked="true" :color="color" :input="false" />
            <span class="checkbox-grid__label">input false</span>
          </label>
        </div>
      </section>

      <section class="checkbox-grid__panel">
        <h3 class="checkbox-grid__title">Accents</h3>
        <div class="checkbox-grid__row">
          <label
            v-for="entry in ['neutral', 'brand', 'red', 'green', 'blue', 'orange'] as UiAccent[]"
            :key="entry"
            class="checkbox-grid__item"
          >
            <Checkbox :checked="true" :color="entry" />
            <span class="checkbox-grid__label">{{ entry }}</span>
          </label>
        </div>
      </section>

      <section class="checkbox-grid__panel">
        <h3 class="checkbox-grid__title">Native form participation</h3>
        <form class="checkbox-grid__form" @submit.prevent="onSubmit">
          <label class="checkbox-grid__item">
            <Checkbox v-model="formLogs" :color="color" name="logs" value="verbose" />
            <span class="checkbox-grid__label">logs=verbose</span>
          </label>
          <label class="checkbox-grid__item">
            <Checkbox v-model="formTraces" :color="color" name="traces" value="all" />
            <span class="checkbox-grid__label">traces=all</span>
          </label>
          <label class="checkbox-grid__item">
            <Checkbox :checked="true" :color="color" disabled name="ignored" value="nope" />
            <span class="checkbox-grid__label">disabled (omitted)</span>
          </label>
          <button class="checkbox-grid__submit" type="submit">Submit</button>
        </form>
        <p class="checkbox-grid__readout">
          {{
            submitted.length
              ? submitted.map(([k, v]) => `${k}=${v}`).join(", ")
              : "no submission yet"
          }}
        </p>
      </section>

      <section class="checkbox-grid__panel">
        <h3 class="checkbox-grid__title">Change events</h3>
        <p class="checkbox-grid__readout">
          {{ changeLog.length ? changeLog.join(" · ") : "toggle the playground checkbox" }}
        </p>
      </section>
    </div>
  </CatalogSection>
</template>

<style scoped>
.checkbox-grid {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.checkbox-grid__panel {
  display: grid;
  gap: 10px;
}

.checkbox-grid__title {
  margin: 0;
  color: var(--cui-foreground-soft);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.checkbox-grid__row,
.checkbox-grid__form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.checkbox-grid__item {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--cui-foreground);
  font-size: 12px;
}

.checkbox-grid__label {
  color: var(--cui-foreground-soft);
}

.checkbox-grid__submit {
  padding: 4px 10px;
  border: 1px solid var(--cui-outline);
  border-radius: var(--cui-radius-sm);
  background: transparent;
  color: var(--cui-foreground);
  font: inherit;
  cursor: pointer;
}

.checkbox-grid__readout {
  margin: 0;
  color: var(--cui-foreground-softer);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 11px;
}
</style>
