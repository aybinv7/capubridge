<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Globe } from "lucide-vue-next";
import { Input } from "@capubridge/cladd";
import { displayAddress, resolveAddress, type AddressResolution } from "@/lib/local-address";

/**
 * The page's address, as a browser shows it: host muted and path bright at rest, the full URL
 * selected on focus. Enter goes there; Escape puts the address back. While typing, it says when
 * the address leaves this origin and so opens as another page.
 */
const props = defineProps<{ url: string }>();
const emit = defineEmits<{ go: [resolution: AddressResolution]; invalid: [text: string] }>();

const field = ref<InstanceType<typeof Input> | null>(null);
const draft = ref(props.url);
const focused = ref(false);

const shown = computed(() => displayAddress(props.url));
const pending = computed(() =>
  focused.value && draft.value.trim() !== props.url ? resolveAddress(draft.value, props.url) : null,
);

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
  emit("go", resolution);
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
        v-if="pending?.kind === 'other-page'"
        class="mr-2 shrink-0 text-2xs whitespace-nowrap text-[var(--fg-subtle)]"
      >
        Opens a new page
      </span>
    </template>
  </Input>
</template>
