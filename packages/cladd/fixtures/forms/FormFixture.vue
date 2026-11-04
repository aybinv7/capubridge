<script setup lang="ts">
import { ref } from 'vue';

import {
  Checkbox,
  Input,
  Radio,
  Select,
  Slider,
  Switch,
  Textarea,
  CladdProvider,
} from '../../src/index.ts';
import type { SelectOption, SelectValue } from '../../src/index.ts';

const emit = defineEmits<{
  submitted: [entries: string[][]];
}>();

const deviceQuery = ref('pixel-9-pro');
const releaseNotes = ref('Initial notes');
const verboseLogging = ref(true);
const targetKind = ref('physical');
const liveReload = ref(true);
const samplingRate = ref(30);
const accent = ref<SelectValue>('cyan');

const accentOptions: SelectOption[] = [
  { label: 'Brand', value: 'brand' },
  { label: 'Cyan', value: 'cyan' },
  { label: 'Green', value: 'green' },
];

function emitSubmittedEntries(event: Event): void {
  const form = event.target as HTMLFormElement;

  emit(
    'submitted',
    [...new FormData(form).entries()].map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}
</script>

<template>
  <CladdProvider accent-color="brand" theme="dark">
    <div class="cladd-form-fixture dark">
      <form
        class="cladd-form-fixture__form"
        data-testid="form"
        @submit.prevent="emitSubmittedEntries"
      >
        <div class="cladd-form-fixture__field">
          <label
            class="cladd-form-fixture__label"
            for="cladd-form-fixture-device-query"
          >
            Device query
          </label>
          <Input
            v-model="deviceQuery"
            data-testid="device-query"
            input-id="cladd-form-fixture-device-query"
            info-message="Matches serial or model name"
            name="deviceQuery"
            placeholder="Pixel 9 Pro"
          />
        </div>

        <div class="cladd-form-fixture__field">
          <label
            class="cladd-form-fixture__label"
            for="cladd-form-fixture-serial"
          >
            Serial
          </label>
          <Input
            data-testid="serial"
            error-message="Serial is required"
            input-id="cladd-form-fixture-serial"
            name="serial"
            required
            :valid="false"
          />
        </div>

        <div class="cladd-form-fixture__field">
          <label
            class="cladd-form-fixture__label"
            for="cladd-form-fixture-fingerprint"
          >
            Build fingerprint
          </label>
          <Input
            data-testid="fingerprint"
            disabled
            input-id="cladd-form-fixture-fingerprint"
            model-value="google/tokay/tokay"
            name="fingerprint"
          />
        </div>

        <div class="cladd-form-fixture__field">
          <span
            class="cladd-form-fixture__label"
            id="cladd-form-fixture-release-notes-label"
          >
            Release notes
          </span>
          <Textarea
            v-model="releaseNotes"
            aria-labelledby="cladd-form-fixture-release-notes-label"
            data-testid="release-notes"
            info-message="Shown in the session report"
          />
        </div>

        <div class="cladd-form-fixture__row">
          <Checkbox
            :checked="verboseLogging"
            data-testid="verbose-logging"
            input-id="cladd-form-fixture-verbose-logging"
            name="verboseLogging"
            value="yes"
            @change="verboseLogging = $event"
          />
          <label
            class="cladd-form-fixture__label"
            for="cladd-form-fixture-verbose-logging"
          >
            Verbose logcat
          </label>
        </div>

        <div class="cladd-form-fixture__row">
          <Checkbox
            data-testid="experimental-inspector"
            input-id="cladd-form-fixture-experimental-inspector"
            name="experimentalInspector"
            value="yes"
          />
          <label
            class="cladd-form-fixture__label"
            for="cladd-form-fixture-experimental-inspector"
          >
            Experimental inspector
          </label>
        </div>

        <div class="cladd-form-fixture__row">
          <Checkbox
            data-testid="archived-sessions"
            disabled
            input-id="cladd-form-fixture-archived-sessions"
            :model-value="true"
            name="archivedSessions"
            value="yes"
          />
          <label
            class="cladd-form-fixture__label"
            for="cladd-form-fixture-archived-sessions"
          >
            Archived sessions
          </label>
        </div>

        <div
          class="cladd-form-fixture__group"
          data-orientation="horizontal"
          role="radiogroup"
        >
          <div class="cladd-form-fixture__row">
            <Radio
              :checked="targetKind === 'physical'"
              data-testid="target-physical"
              input-id="cladd-form-fixture-target-physical"
              name="targetKind"
              value="physical"
              @change="targetKind = 'physical'"
            />
            <label
              class="cladd-form-fixture__label"
              for="cladd-form-fixture-target-physical"
            >
              Physical device
            </label>
          </div>
          <div class="cladd-form-fixture__row">
            <Radio
              :checked="targetKind === 'emulator'"
              data-testid="target-emulator"
              input-id="cladd-form-fixture-target-emulator"
              name="targetKind"
              value="emulator"
              @change="targetKind = 'emulator'"
            />
            <label
              class="cladd-form-fixture__label"
              for="cladd-form-fixture-target-emulator"
            >
              Emulator
            </label>
          </div>
        </div>

        <div class="cladd-form-fixture__row">
          <Switch
            v-model="liveReload"
            data-testid="live-reload"
            input-id="cladd-form-fixture-live-reload"
            name="liveReload"
            value="on"
          />
          <label
            class="cladd-form-fixture__label"
            for="cladd-form-fixture-live-reload"
          >
            Live reload
          </label>
        </div>

        <div class="cladd-form-fixture__field">
          <span
            class="cladd-form-fixture__label"
            id="cladd-form-fixture-sampling-rate-label"
          >
            Sampling rate
          </span>
          <Slider
            aria-labelledby="cladd-form-fixture-sampling-rate-label"
            data-testid="sampling-rate"
            name="samplingRate"
            :step="5"
            :value="samplingRate"
            @update:value="samplingRate = $event"
          />
        </div>

        <div class="cladd-form-fixture__field">
          <span
            class="cladd-form-fixture__label"
            id="cladd-form-fixture-buffer-size-label"
          >
            Buffer size
          </span>
          <Slider
            aria-labelledby="cladd-form-fixture-buffer-size-label"
            data-testid="buffer-size"
            :default-value="40"
            name="bufferSize"
            :step="10"
          />
        </div>

        <div class="cladd-form-fixture__field">
          <span class="cladd-form-fixture__label">Accent</span>
          <Select
            v-model="accent"
            aria-label="Accent"
            data-testid="accent"
            :options="accentOptions"
            title="Accent"
          />
        </div>

        <div class="cladd-form-fixture__actions">
          <button data-testid="submit" type="submit">Save session</button>
          <button data-testid="reset" type="reset">Reset</button>
        </div>
      </form>
    </div>
  </CladdProvider>
</template>

<style scoped>
.cladd-form-fixture {
  padding: 24px;
  background: var(--cladd-background);
  font-family: Inter, sans-serif;
}

.cladd-form-fixture__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 420px;
}

.cladd-form-fixture__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cladd-form-fixture__row,
.cladd-form-fixture__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cladd-form-fixture__group {
  display: flex;
  gap: 16px;
}

.cladd-form-fixture__label {
  color: var(--cladd-foreground-soft);
  font-size: 11px;
  letter-spacing: 0.04em;
}
</style>
