<script setup lang="ts">
import { ref } from "vue";

import {
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Textarea,
  UiProvider,
} from "../../src/index.ts";
import type { SelectOption, SelectValue } from "../../src/index.ts";

const emit = defineEmits<{
  submitted: [entries: string[][]];
}>();

const deviceQuery = ref("pixel-9-pro");
const releaseNotes = ref("Initial notes");
const verboseLogging = ref(true);
const targetKind = ref("physical");
const liveReload = ref(true);
const samplingRate = ref(30);
const accent = ref<SelectValue>("cyan");

const accentOptions: SelectOption[] = [
  { label: "Brand", value: "brand" },
  { label: "Cyan", value: "cyan" },
  { label: "Green", value: "green" },
];

function emitSubmittedEntries(event: Event): void {
  const form = event.target as HTMLFormElement;

  emit(
    "submitted",
    [...new FormData(form).entries()].map(([name, value]) => [name, String(value)]),
  );
}
</script>

<template>
  <UiProvider accent="brand" class="cui-form-fixture" theme="dark">
    <form class="cui-form-fixture__form" data-testid="form" @submit.prevent="emitSubmittedEntries">
      <div class="cui-form-fixture__field">
        <label class="cui-form-fixture__label" for="cui-form-fixture-device-query">
          Device query
        </label>
        <Input
          id="cui-form-fixture-device-query"
          v-model="deviceQuery"
          data-testid="device-query"
          info-message="Matches serial or model name"
          name="deviceQuery"
          placeholder="Pixel 9 Pro"
        />
      </div>

      <div class="cui-form-fixture__field">
        <label class="cui-form-fixture__label" for="cui-form-fixture-serial"> Serial </label>
        <Input
          id="cui-form-fixture-serial"
          data-testid="serial"
          error-message="Serial is required"
          name="serial"
          required
          :valid="false"
        />
      </div>

      <div class="cui-form-fixture__field">
        <label class="cui-form-fixture__label" for="cui-form-fixture-fingerprint">
          Build fingerprint
        </label>
        <Input
          id="cui-form-fixture-fingerprint"
          data-testid="fingerprint"
          disabled
          model-value="google/tokay/tokay"
          name="fingerprint"
        />
      </div>

      <div class="cui-form-fixture__field">
        <label class="cui-form-fixture__label" for="cui-form-fixture-release-notes">
          Release notes
        </label>
        <Textarea
          id="cui-form-fixture-release-notes"
          v-model="releaseNotes"
          data-testid="release-notes"
          info-message="Shown in the session report"
          name="releaseNotes"
        />
      </div>

      <div class="cui-form-fixture__row">
        <Checkbox
          :checked="verboseLogging"
          data-testid="verbose-logging"
          input-id="cui-form-fixture-verbose-logging"
          name="verboseLogging"
          value="yes"
          @change="verboseLogging = $event"
        />
        <label class="cui-form-fixture__label" for="cui-form-fixture-verbose-logging">
          Verbose logcat
        </label>
      </div>

      <div class="cui-form-fixture__row">
        <Checkbox
          data-testid="experimental-inspector"
          input-id="cui-form-fixture-experimental-inspector"
          name="experimentalInspector"
          value="yes"
        />
        <label class="cui-form-fixture__label" for="cui-form-fixture-experimental-inspector">
          Experimental inspector
        </label>
      </div>

      <div class="cui-form-fixture__row">
        <Checkbox
          data-testid="archived-sessions"
          disabled
          input-id="cui-form-fixture-archived-sessions"
          :model-value="true"
          name="archivedSessions"
          value="yes"
        />
        <label class="cui-form-fixture__label" for="cui-form-fixture-archived-sessions">
          Archived sessions
        </label>
      </div>

      <RadioGroup
        v-model="targetKind"
        class="cui-form-fixture__group"
        name="targetKind"
        orientation="horizontal"
      >
        <div class="cui-form-fixture__row">
          <Radio
            data-testid="target-physical"
            input-id="cui-form-fixture-target-physical"
            value="physical"
          />
          <label class="cui-form-fixture__label" for="cui-form-fixture-target-physical">
            Physical device
          </label>
        </div>
        <div class="cui-form-fixture__row">
          <Radio
            data-testid="target-emulator"
            input-id="cui-form-fixture-target-emulator"
            value="emulator"
          />
          <label class="cui-form-fixture__label" for="cui-form-fixture-target-emulator">
            Emulator
          </label>
        </div>
      </RadioGroup>

      <div class="cui-form-fixture__row">
        <Switch
          v-model="liveReload"
          data-testid="live-reload"
          input-id="cui-form-fixture-live-reload"
          name="liveReload"
          value="on"
        />
        <label class="cui-form-fixture__label" for="cui-form-fixture-live-reload">
          Live reload
        </label>
      </div>

      <div class="cui-form-fixture__field">
        <span class="cui-form-fixture__label" id="cui-form-fixture-sampling-rate-label">
          Sampling rate
        </span>
        <Slider
          aria-labelledby="cui-form-fixture-sampling-rate-label"
          data-testid="sampling-rate"
          name="samplingRate"
          :step="5"
          :value="samplingRate"
          @update:value="samplingRate = $event"
        />
      </div>

      <div class="cui-form-fixture__field">
        <span class="cui-form-fixture__label" id="cui-form-fixture-buffer-size-label">
          Buffer size
        </span>
        <Slider
          aria-labelledby="cui-form-fixture-buffer-size-label"
          data-testid="buffer-size"
          :default-value="40"
          name="bufferSize"
          :step="10"
        />
      </div>

      <div class="cui-form-fixture__field">
        <span class="cui-form-fixture__label">Accent</span>
        <Select
          v-model="accent"
          aria-label="Accent"
          data-testid="accent"
          :options="accentOptions"
          title="Accent"
        />
      </div>

      <div class="cui-form-fixture__actions">
        <button data-testid="submit" type="submit">Save session</button>
        <button data-testid="reset" type="reset">Reset</button>
      </div>
    </form>
  </UiProvider>
</template>

<style scoped>
.cui-form-fixture {
  padding: 24px;
  background: var(--cui-background);
  font-family: Geist, sans-serif;
}

.cui-form-fixture__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 420px;
}

.cui-form-fixture__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cui-form-fixture__row,
.cui-form-fixture__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cui-form-fixture__group {
  display: flex;
  gap: 16px;
}

.cui-form-fixture__label {
  color: var(--cui-foreground-soft);
  font-size: 11px;
  letter-spacing: 0.04em;
}
</style>
