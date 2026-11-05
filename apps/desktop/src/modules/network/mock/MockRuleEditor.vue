<script setup lang="ts">
import { computed, ref } from "vue";
import { Copy, Download, Maximize2, Trash2 } from "lucide-vue-next";
import {
  Button,
  Input,
  NumberField,
  Segmented,
  SegmentedButton,
  Select,
  Switch,
} from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { HttpMethodFilter, MockInterceptMode } from "@/types/mock.types";
import MockBodyDialog from "./MockBodyDialog.vue";
import MockBodyEditor from "./MockBodyEditor.vue";
import MockHeadersEditor from "./MockHeadersEditor.vue";
import type { MockRuleDraft } from "./mockDraft";
import { prettyBody } from "./mockFromRequest";
import {
  CONTENT_TYPES,
  DELAY_MAX_MS,
  HTTP_METHODS,
  MATCH_TYPES,
  PATTERN_PLACEHOLDERS,
  STATUS_MAX,
  STATUS_MIN,
  clampInteger,
} from "./mockView";

const draft = defineModel<MockRuleDraft>("draft", { required: true });

const props = defineProps<{ mode: MockInterceptMode; port: number; transferPending: boolean }>();

const emit = defineEmits<{ duplicate: []; export: []; remove: [] }>();

const bodyDialogOpen = ref(false);

function patch<K extends keyof MockRuleDraft>(field: K, value: MockRuleDraft[K]) {
  draft.value = { ...draft.value, [field]: value };
}

function openBody() {
  const pretty = prettyBody(draft.value.responseBody, draft.value.contentType);
  if (pretty !== draft.value.responseBody) patch("responseBody", pretty);
  bodyDialogOpen.value = true;
}

const isJson = computed(() => draft.value.contentType.includes("json"));
const contentTypeOptions = computed(() => {
  const current = draft.value.contentType;
  const known = (CONTENT_TYPES as readonly string[]).includes(current);
  return [...CONTENT_TYPES, ...(known || !current ? [] : [current])].map((value) => ({
    value,
    label: value,
  }));
});
const methodOptions = HTTP_METHODS.map((method) => ({
  value: method,
  label: method === "ANY" ? "Any method" : method,
}));
const matchHint = computed(
  () => MATCH_TYPES.find((option) => option.value === draft.value.urlMatchType)?.hint ?? "",
);

const methodModel = computed({
  get: () => draft.value.method,
  set: (value: unknown) => patch("method", String(value) as HttpMethodFilter),
});
const contentTypeModel = computed({
  get: () => draft.value.contentType,
  set: (value: unknown) => patch("contentType", String(value ?? "")),
});
const statusModel = computed({
  get: () => draft.value.statusCode,
  set: (value: unknown) =>
    patch("statusCode", clampInteger(value, STATUS_MIN, STATUS_MAX, draft.value.statusCode)),
});
const delayModel = computed({
  get: () => draft.value.delayMs,
  set: (value: unknown) => patch("delayMs", clampInteger(value, 0, DELAY_MAX_MS, 0)),
});
const bodyModel = computed({
  get: () => draft.value.responseBody,
  set: (value: string) => patch("responseBody", value),
});
const headersModel = computed({
  get: () => draft.value.responseHeaders,
  set: (value) => patch("responseHeaders", value),
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-3xl flex-col gap-6 p-5">
      <div class="flex items-center gap-2">
        <Input
          :model-value="draft.name"
          size="md"
          class="min-w-0 flex-1"
          placeholder="Rule name"
          aria-label="Rule name"
          @update:model-value="patch('name', $event)"
        />
        <IconAction label="Duplicate rule" @click="emit('duplicate')">
          <Copy :stroke-width="1.8" />
        </IconAction>
        <IconAction
          label="Export rule"
          hint="Saves this rule to a file another Capubridge can import"
          :loading="props.transferPending"
          @click="emit('export')"
        >
          <Download :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Delete rule" @click="emit('remove')">
          <Trash2 :stroke-width="1.8" />
        </IconAction>
      </div>

      <section class="flex flex-col gap-2.5" aria-labelledby="mock-match-title">
        <h3 id="mock-match-title" class="text-xs font-medium text-foreground">Which requests</h3>
        <div class="flex items-center gap-2">
          <Select
            v-model="methodModel"
            :options="methodOptions"
            size="sm"
            :keyboard-hints="false"
            aria-label="Method"
            class="w-32 shrink-0 font-mono"
          />
          <Input
            :model-value="draft.urlPattern"
            size="sm"
            class="min-w-0 flex-1"
            input-class-name="font-mono"
            :placeholder="PATTERN_PLACEHOLDERS[draft.urlMatchType]"
            aria-label="Address pattern"
            @update:model-value="patch('urlPattern', $event)"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Segmented size="sm" aria-label="How the address is matched">
            <SegmentedButton
              v-for="option in MATCH_TYPES"
              :key="option.value"
              :active="draft.urlMatchType === option.value"
              :title="option.hint"
              @click="patch('urlMatchType', option.value)"
            >
              {{ option.label }}
            </SegmentedButton>
          </Segmented>
          <span class="text-xs text-muted-foreground">
            {{ draft.urlPattern ? matchHint : "An empty pattern matches every address." }}
          </span>
        </div>
      </section>

      <section class="flex flex-col gap-2.5" aria-labelledby="mock-response-title">
        <h3 id="mock-response-title" class="text-xs font-medium text-foreground">Answer with</h3>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            Status
            <NumberField
              v-model="statusModel"
              size="sm"
              :min="STATUS_MIN"
              :max="STATUS_MAX"
              :step="1"
              class="w-32"
              input-class-name="font-mono"
              aria-label="Status code"
            />
          </label>
          <label class="flex min-w-56 flex-1 items-center gap-2 text-xs text-muted-foreground">
            Content type
            <Select
              v-model="contentTypeModel"
              :options="contentTypeOptions"
              size="sm"
              :keyboard-hints="false"
              aria-label="Content type"
              class="min-w-0 flex-1 font-mono"
            />
          </label>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            Delay
            <NumberField
              v-model="delayModel"
              size="sm"
              :min="0"
              :max="DELAY_MAX_MS"
              :step="100"
              class="w-28"
              input-class-name="font-mono"
              aria-label="Delay in milliseconds"
            />
            ms
          </label>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">Body</span>
          <Button
            size="sm"
            variant="transparent"
            :outline="false"
            content-class-name="gap-1.5"
            class="text-muted-foreground hover:text-foreground"
            @click="openBody"
          >
            <Maximize2 :size="12" :stroke-width="1.8" aria-hidden="true" />
            Open larger
          </Button>
        </div>
        <div class="h-44">
          <MockBodyEditor v-model="bodyModel" :json="isJson" label="Response body" />
        </div>
      </section>

      <section class="flex flex-col gap-2.5" aria-labelledby="mock-headers-title">
        <h3 id="mock-headers-title" class="text-xs font-medium text-foreground">
          Response headers
        </h3>
        <MockHeadersEditor v-model="headersModel" />
      </section>

      <section class="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
        <div class="flex flex-col gap-0.5">
          <span class="text-xs font-medium text-foreground">Pass through</span>
          <span class="text-xs text-muted-foreground">
            Count matching requests but let them reach the real server.
          </span>
        </div>
        <Switch
          :model-value="draft.passThrough"
          aria-label="Pass through"
          @update:model-value="patch('passThrough', $event === true)"
        />
      </section>

      <p
        v-if="props.mode === 'http'"
        class="rounded-control bg-info-bg px-3 py-2 text-xs text-foreground"
        role="note"
      >
        The local server answers at
        <span class="font-mono">http://127.0.0.1:{{ props.port }}</span
        >. Point the app at that address, then use Connect the phone so the phone's localhost
        reaches this computer.
      </p>
    </div>

    <MockBodyDialog
      v-model:open="bodyDialogOpen"
      v-model:body="bodyModel"
      :json="isJson"
      :rule-name="draft.name"
    />
  </div>
</template>
