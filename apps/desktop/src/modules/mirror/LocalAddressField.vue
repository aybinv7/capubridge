<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Globe } from "lucide-vue-next";
import { Input } from "@capubridge/cladd";
import { displayAddress, resolveAddress } from "@/lib/local-address";

/**
 * The tab's address, as a browser shows it: host muted and path bright at rest, the full URL
 * selected on focus. Enter goes there in this tab, Alt+Enter in a new tab; Escape puts the address
 * back. A path stays on the page's own site.
 */
const props = defineProps<{ url: string }>();
const emit = defineEmits<{ go: [url: string, newTab: boolean]; invalid: [text: string] }>();

const field = ref<InstanceType<typeof Input> | null>(null);
const draft = ref(props.url);
const focused = ref(false);

const shown = computed(() => displayAddress(props.url));

watch(
  () => props.url,
  (next) => {
    if (!focused.value) draft.value = next;
  },
);

function onFocus() {
  focused.value = true;
  draft.value = props.url;
  void nextTick(() => field.value?.select());
}

function onBlur() {
  focused.value = false;
  draft.value = props.url;
}

function leave() {
  field.value?.inputElement?.blur();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    leave();
    return;
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  const resolution = resolveAddress(draft.value, props.url);
  if (!resolution) {
    emit("invalid", draft.value);
    return;
  }
  emit("go", resolution.url, event.altKey);
  leave();
}
</script>

<template>
  <Input
    ref="field"
    v-model="draft"
    size="sm"
    input-mode="url"
    class="min-w-0 flex-1"
    input-class-name="font-normal"
    :input-props="{ spellcheck: false, autocomplete: 'off', 'aria-label': 'Page address' }"
    placeholder="A path, or a URL"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="onKeydown"
  >
    <template #icon>
      <Globe :stroke-width="1.8" class="text-[var(--fg-subtle)]" />
    </template>
    <template #displayValue>
      <span class="min-w-0 truncate">
        <span class="text-muted-foreground">{{ shown.origin }}</span>
        <span class="text-foreground">{{ shown.rest }}</span>
      </span>
    </template>
    <template #suffix>
      <span
        v-if="focused"
        class="mr-2 shrink-0 text-2xs whitespace-nowrap text-[var(--fg-subtle)]"
        aria-hidden="true"
      >
        Alt+Enter: new tab
      </span>
    </template>
  </Input>
</template>
