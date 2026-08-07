<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  useId,
  useTemplateRef,
  watch,
} from "vue";

import Button from "../actions/Button.vue";
import Shortcut from "../data-display/Shortcut.vue";
import Popover from "../overlays/Popover.vue";
import Checkbox from "./Checkbox.vue";
import Input from "./Input.vue";
import Radio from "./Radio.vue";
import SelectDropdownIcon from "./SelectDropdownIcon.vue";
import {
  getDefaultOptionInfo,
  getDefaultOptionLabel,
  getDefaultOptionValue,
  type SelectOptionInput,
  type SelectOptionParams,
  type SelectProps,
  type SelectValue,
} from "./select.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectProps>(), {
  accent: undefined,
  closeOnSelect: true,
  color: undefined,
  contentClassName: undefined,
  disabled: false,
  dropdownIcon: true,
  focused: false,
  getOptionValue: undefined,
  hoverable: true,
  indicatorColor: undefined,
  isChecked: undefined,
  isOptionDisabled: undefined,
  keyboardHints: true,
  keyboardHintsOutline: false,
  keyboardHintsSize: "md",
  keyboardHintsVariant: "transparent",
  multiline: false,
  multiple: false,
  noneOptionValue: undefined,
  optionIndicatorColor: undefined,
  optionInfo: undefined,
  optionLabel: undefined,
  options: () => [],
  outline: true,
  placeholder: "",
  popoverAccent: undefined,
  popoverOffset: 4,
  popoverPosition: "bottom-end",
  popoverSurfaceLevel: undefined,
  readOnly: false,
  pressed: false,
  reverse: false,
  rounded: false,
  scrollToSelected: false,
  search: false,
  searchFilter: undefined,
  searchFocus: false,
  searchNotFound: "Nothing found",
  searchPlaceholder: "Search",
  size: "md",
  surface: "surface",
  tightFocusRing: false,
  title: undefined,
  valueClassName: undefined,
  variant: "gradient",
});

const slots = defineSlots<{
  afterOption?: (params: { index: number; value: SelectOptionInput }) => unknown;
  afterOptions?: () => unknown;
  beforeOption?: (params: { index: number; value: SelectOptionInput }) => unknown;
  beforeOptions?: () => unknown;
  default?: (params: {
    selected: readonly SelectOptionInput[];
    value: SelectValue | SelectValue[];
  }) => unknown;
  dropdownIcon?: () => unknown;
  empty?: (params: { query: string }) => unknown;
  icon?: () => unknown;
  option?: (params: SelectOptionParams) => unknown;
  optionInfo?: (params: SelectOptionParams) => unknown;
}>();

const emit = defineEmits<{
  change: [value: SelectValue | SelectValue[]];
  click: [event: MouseEvent];
  closed: [];
  closing: [];
  opened: [];
  opening: [];
  search: [query: string];
}>();

const model = defineModel<SelectValue | SelectValue[]>({ default: "" });
const open = defineModel<boolean>("open", { default: false });
const attrs = useAttrs();
const query = ref("");
const activeIndex = ref(-1);
const touchDevice = ref(false);
const list = useTemplateRef<HTMLElement>("list");
const searchInput = useTemplateRef<InstanceType<typeof Input>>("searchInput");
const listboxId = `cui-select-${useId()}`;

const selectedValues = computed<SelectValue[]>(() =>
  Array.isArray(model.value) ? model.value : [model.value],
);
const displayedOptions = computed<readonly SelectOptionInput[]>(() => {
  if (!props.search) return props.options;
  if (props.searchFilter) return props.searchFilter(query.value);
  const normalized = query.value.trim().toLocaleLowerCase();
  if (!normalized) return props.options;
  return props.options.filter((option) =>
    optionLabel(option, props.options.indexOf(option)).toLocaleLowerCase().includes(normalized),
  );
});
const selectedOptions = computed(() => props.options.filter((option) => optionSelected(option)));
const triggerText = computed(() => {
  if (!selectedOptions.value.length) return props.placeholder;
  if (props.multiple) return selectedOptions.value.map((option) => optionLabel(option)).join(", ");
  return optionLabel(selectedOptions.value[0]);
});
const hasCustomValue = computed(() => Boolean(slots.default));
const showHints = computed(() => props.keyboardHints && !touchDevice.value);

function optionValue(option: SelectOptionInput): SelectValue {
  return props.getOptionValue?.(option) ?? getDefaultOptionValue(option);
}

function optionParams(
  option: SelectOptionInput,
  index = props.options.indexOf(option),
): SelectOptionParams {
  return { index, selected: optionSelected(option), value: option };
}

function optionLabel(option: SelectOptionInput, index = props.options.indexOf(option)): string {
  return props.optionLabel?.(optionParams(option, index)) ?? getDefaultOptionLabel(option);
}

function optionInfo(option: SelectOptionInput, index: number): string | undefined {
  return props.optionInfo?.(optionParams(option, index)) ?? getDefaultOptionInfo(option);
}

function optionSelected(option: SelectOptionInput): boolean {
  if (props.isChecked) return props.isChecked(option);
  return selectedValues.value.includes(optionValue(option));
}

function optionDisabled(option: SelectOptionInput): boolean {
  if (props.isOptionDisabled) return props.isOptionDisabled(option);
  return (
    typeof option === "object" &&
    option !== null &&
    "disabled" in option &&
    option.disabled === true
  );
}

function indicatorAccent(option: SelectOptionInput, index: number) {
  return props.optionIndicatorColor?.(optionParams(option, index)) ?? props.indicatorColor;
}

function publish(next: SelectValue | SelectValue[]): void {
  model.value = next;
  emit("change", next);
}

function selectOption(option: SelectOptionInput): void {
  if (optionDisabled(option) || props.disabled || props.readOnly) return;
  const value = optionValue(option);
  if (props.multiple) {
    publish(
      optionSelected(option)
        ? selectedValues.value.filter((selected) => selected !== value)
        : [...selectedValues.value.filter((selected) => selected !== ""), value],
    );
    return;
  }
  publish(value);
  if (props.closeOnSelect) open.value = false;
}

function hintFor(option: SelectOptionInput, index: number): number | undefined {
  if (props.noneOptionValue !== undefined) {
    if (optionValue(option) === props.noneOptionValue) return 0;
    const ranked = displayedOptions.value
      .slice(0, index + 1)
      .filter((entry) => optionValue(entry) !== props.noneOptionValue).length;
    return ranked <= 9 ? ranked : undefined;
  }
  if (index < 9) return index + 1;
  return index === 9 ? 0 : undefined;
}

function optionForDigit(digit: number): SelectOptionInput | undefined {
  return displayedOptions.value.find((option, index) => hintFor(option, index) === digit);
}

function moveActive(direction: 1 | -1): void {
  if (!displayedOptions.value.length) return;
  let next = activeIndex.value;
  if (next < 0) {
    next = displayedOptions.value.findIndex(optionSelected);
    if (next < 0) next = direction === 1 ? -1 : 0;
  }
  for (let attempts = 0; attempts < displayedOptions.value.length; attempts += 1) {
    next = (next + direction + displayedOptions.value.length) % displayedOptions.value.length;
    if (!optionDisabled(displayedOptions.value[next])) break;
  }
  activeIndex.value = next;
  nextTick(() => {
    list.value
      ?.querySelector<HTMLElement>(`[data-option-index="${next}"]`)
      ?.focus({ preventScroll: true });
    list.value
      ?.querySelector<HTMLElement>(`[data-option-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (!open.value) return;
  const searchFocused = Boolean(document.activeElement?.closest(".cui-select__search"));
  if (showHints.value && !searchFocused && /^[0-9]$/.test(event.key)) {
    const option = optionForDigit(Number(event.key));
    if (option) {
      event.preventDefault();
      selectOption(option);
    }
    return;
  }
  if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
    event.preventDefault();
    moveActive(1);
  } else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
    event.preventDefault();
    moveActive(-1);
  } else if ((event.key === "Enter" || event.key === " ") && !searchFocused) {
    const option = displayedOptions.value[activeIndex.value];
    if (option) {
      event.preventDefault();
      selectOption(option);
    }
  }
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (props.disabled || props.readOnly) return;
  if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key) && !open.value) {
    event.preventDefault();
    open.value = true;
  }
}

function handleTriggerClick(event: MouseEvent): void {
  emit("click", event);
}

function handleOpening(): void {
  emit("opening");
}

function handleOpened(): void {
  emit("opened");
  nextTick(() => {
    if (props.searchFocus) searchInput.value?.focus();
    if (props.scrollToSelected) {
      list.value
        ?.querySelector<HTMLElement>("[aria-selected='true']")
        ?.scrollIntoView({ block: "center" });
    }
  });
}

watch(query, (value) => emit("search", value));
watch(open, () => {
  query.value = "";
  activeIndex.value = -1;
});

onMounted(() => {
  touchDevice.value = navigator.maxTouchPoints > 0;
  document.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => document.removeEventListener("keydown", handleDocumentKeydown));
</script>

<template>
  <Popover
    v-model="open"
    :accent="props.popoverAccent"
    content-class-name="cui-select__popover"
    :disabled="props.disabled || props.readOnly"
    :offset="props.popoverOffset"
    :position="props.popoverPosition"
    :surface-level="props.popoverSurfaceLevel"
    @closed="emit('closed')"
    @closing="emit('closing')"
    @opened="handleOpened"
    @opening="handleOpening"
  >
    <template #trigger>
      <Button
        v-bind="attrs"
        class="cui-select"
        :class="{ 'cui-select--reverse': props.reverse }"
        :color="props.color"
        :accent="props.accent"
        :content-class-name="props.contentClassName"
        :disabled="props.disabled"
        :focused="props.focused"
        :hoverable="props.hoverable"
        :multiline="props.multiline"
        :outline="props.outline"
        :pressed="props.pressed"
        :read-only="props.readOnly"
        :rounded="props.rounded"
        role="combobox"
        :aria-activedescendant="
          open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        "
        :aria-controls="open ? listboxId : undefined"
        :aria-expanded="open"
        aria-haspopup="listbox"
        :size="props.size"
        :surface="props.surface"
        :tight-focus-ring="props.tightFocusRing"
        :variant="props.variant"
        @click="handleTriggerClick"
        @keydown="handleTriggerKeydown"
      >
        <span v-if="$slots.icon" class="cui-select__icon"><slot name="icon" /></span>
        <span
          class="cui-select__value"
          :class="props.valueClassName"
          :data-placeholder="!selectedOptions.length || undefined"
        >
          <slot v-if="hasCustomValue" :selected="selectedOptions" :value="model" />
          <template v-else>{{ triggerText }}</template>
        </span>
        <span v-if="props.dropdownIcon" class="cui-select__chevron" aria-hidden="true">
          <slot name="dropdownIcon"><SelectDropdownIcon /></slot>
        </span>
      </Button>
    </template>

    <div class="cui-select__panel">
      <div v-if="props.title" class="cui-select__title">{{ props.title }}</div>
      <Input
        v-if="props.search"
        ref="searchInput"
        v-model="query"
        class="cui-select__search"
        clearable
        :placeholder="props.searchPlaceholder"
        size="md"
        type="search"
      />
      <slot name="beforeOptions" />
      <div
        ref="list"
        :id="listboxId"
        class="cui-select__list"
        role="listbox"
        :aria-multiselectable="props.multiple || undefined"
      >
        <template v-for="(option, index) in displayedOptions" :key="String(optionValue(option))">
          <slot name="beforeOption" :index="index" :value="option" />
          <Button
            class="cui-select__option"
            content-class-name="cui-select__option-content"
            :data-option-index="index"
            :id="`${listboxId}-${index}`"
            :disabled="optionDisabled(option)"
            multiline
            :outline="activeIndex === index"
            rounded
            role="option"
            :aria-selected="optionSelected(option)"
            size="lg"
            type="button"
            :variant="activeIndex === index ? 'gradient' : 'transparent'"
            @click.stop="selectOption(option)"
          >
            <Checkbox
              v-if="props.multiple"
              as="span"
              :checked="optionSelected(option)"
              :color="indicatorAccent(option, index)"
              :disabled="optionDisabled(option)"
              :focusable="false"
              :hoverable="false"
              :input="false"
              size="sm"
            />
            <Radio
              v-else
              as="span"
              :checked="optionSelected(option)"
              :color="indicatorAccent(option, index)"
              :disabled="optionDisabled(option)"
              :focusable="false"
              :hoverable="false"
              :input="false"
              size="sm"
            />
            <span class="cui-select__option-copy">
              <slot name="option" v-bind="optionParams(option, index)">{{
                optionLabel(option, index)
              }}</slot>
              <span
                v-if="$slots.optionInfo || optionInfo(option, index)"
                class="cui-select__option-info"
              >
                <slot name="optionInfo" v-bind="optionParams(option, index)">{{
                  optionInfo(option, index)
                }}</slot>
              </span>
            </span>
            <Shortcut
              v-if="showHints && hintFor(option, index) !== undefined"
              class="cui-select__hint"
              :outline="props.keyboardHintsOutline"
              :size="props.keyboardHintsSize"
              :variant="props.keyboardHintsVariant"
              >{{ hintFor(option, index) }}</Shortcut
            >
          </Button>
          <slot name="afterOption" :index="index" :value="option" />
        </template>
        <div v-if="!displayedOptions.length" class="cui-select__empty">
          <slot name="empty" :query="query">{{ props.searchNotFound }}</slot>
        </div>
      </div>
      <slot name="afterOptions" />
    </div>
  </Popover>
</template>
