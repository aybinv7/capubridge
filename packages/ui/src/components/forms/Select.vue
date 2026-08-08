<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from "vue";

import { useDevice } from "../../composables/useDevice.ts";
import { cn } from "../../shared/cn.ts";
import Button from "../actions/Button.vue";
import { buttonIconSizes } from "../actions/button.contracts.ts";
import List from "../data-display/List.vue";
import ListButton from "../data-display/ListButton.vue";
import SectionTitle from "../data-display/SectionTitle.vue";
import Shortcut from "../data-display/Shortcut.vue";
import Popover from "../overlays/Popover.vue";
import Surface from "../surface/Surface.vue";
import Checkbox from "./Checkbox.vue";
import Radio from "./Radio.vue";
import SearchField from "./SearchField.vue";
import SelectDropdownIcon from "./SelectDropdownIcon.vue";
import {
  getDefaultOptionInfo,
  getDefaultOptionLabel,
  getDefaultOptionValue,
  selectDropdownIconClasses,
  selectEmptyClasses,
  selectHintClasses,
  selectHintKeyClasses,
  selectIconClasses,
  selectOptionContentClasses,
  selectOptionCopyClasses,
  selectOptionIndicatorClasses,
  selectOptionInfoClasses,
  selectOptionRowClasses,
  selectPlaceholderClasses,
  selectPopoverClasses,
  selectPopoverOffset,
  selectSearchFieldClasses,
  selectSearchFieldInsetClasses,
  selectSearchInsetWrapperClasses,
  selectSearchStickyContentClasses,
  selectSearchStickyWrapperClasses,
  selectTitleClasses,
  selectTriggerClasses,
  selectTriggerContentClasses,
  selectTriggerDropdownPaddingClasses,
  selectTriggerReverseClasses,
  selectValueClasses,
  type SelectOptionInput,
  type SelectOptionParams,
  type SelectProps,
  type SelectValue,
} from "./select.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectProps>(), {
  accent: undefined,
  anchorElement: undefined,
  closeOnSelect: true,
  color: undefined,
  contentClassName: undefined,
  disabled: false,
  dropdownIcon: true,
  focused: false,
  getOptionValue: undefined,
  hoverable: true,
  iconClassName: undefined,
  indicatorColor: undefined,
  isChecked: undefined,
  isOptionDisabled: undefined,
  keyboardHints: true,
  keyboardHintsClassName: undefined,
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
  placeholderClassName: undefined,
  popoverAccent: undefined,
  popoverClassName: undefined,
  popoverOffset: () => selectPopoverOffset,
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
const device = useDevice();
const query = ref("");
const selectedItemIndex = ref(-1);
const triggerElement = ref<HTMLElement>();
const list = ref<HTMLElement>();
const searchField = ref<HTMLElement>();
const id = useId();
const listboxId = `cui-select-listbox-${id}`;
const optionIdPrefix = `cui-select-option-${id}`;

const selectedValues = computed<SelectValue[]>(() =>
  Array.isArray(model.value) ? model.value : [model.value],
);

// Upstream keeps no internal filter state: with `search` + a filter callback the caller controls
// matching, otherwise every option is shown.
const displayOptions = computed<readonly SelectOptionInput[]>(() =>
  props.search && props.searchFilter ? props.searchFilter(query.value) : props.options,
);

const selectedOptions = computed(() => props.options.filter((option) => optionSelected(option)));

// Upstream renders `String(value)`, not the option label — richer displays go through the
// default slot (upstream's `children`).
const triggerValue = computed(() =>
  model.value !== null &&
  model.value !== undefined &&
  model.value !== "" &&
  !Array.isArray(model.value)
    ? String(model.value)
    : "",
);

const searchInset = computed(() => Boolean(props.title));
const showHints = computed(
  () => props.keyboardHints && displayOptions.value.length > 1 && !device.mobile,
);

const triggerClass = computed(() => cn(selectTriggerClasses, attrs.class));
const triggerContentClass = computed(() =>
  cn(
    props.dropdownIcon && selectTriggerDropdownPaddingClasses,
    selectTriggerContentClasses,
    props.reverse && selectTriggerReverseClasses,
    props.contentClassName,
  ),
);
const iconClass = computed(() =>
  cn(selectIconClasses, buttonIconSizes[props.size], props.iconClassName),
);
const valueClass = computed(() =>
  cn(
    selectValueClasses,
    !slots.default && !triggerValue.value && selectPlaceholderClasses,
    props.placeholderClassName,
    props.valueClassName,
  ),
);
const popoverClass = computed(() => cn(selectPopoverClasses, props.popoverClassName));
const searchWrapperClass = computed(() =>
  searchInset.value ? selectSearchInsetWrapperClasses : selectSearchStickyWrapperClasses,
);
const searchWrapperContentClass = computed(() =>
  searchInset.value ? selectSearchInsetWrapperClasses : selectSearchStickyContentClasses,
);
const searchFieldClass = computed(() =>
  cn(selectSearchFieldClasses, searchInset.value && selectSearchFieldInsetClasses),
);
const hintKeyClass = computed(() => cn(selectHintKeyClasses, props.keyboardHintsClassName));
const triggerAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

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

function onChangeInternal(option: SelectOptionInput, checked: boolean): void {
  const key = optionValue(option);
  if (!props.multiple) {
    model.value = key;
    emit("change", key);
  } else {
    const next = selectedValues.value.filter((value) => value !== "");
    if (checked) next.push(key);
    else if (next.includes(key)) next.splice(next.indexOf(key), 1);
    model.value = next;
    emit("change", next);
  }
  if (!props.multiple && props.closeOnSelect) open.value = false;
}

function hintFor(option: SelectOptionInput, index: number): number | undefined {
  if (props.noneOptionValue !== undefined) {
    if (optionValue(option) === props.noneOptionValue) return 0;
    let rank = 0;
    for (let i = 0; i <= index; i += 1) {
      if (optionValue(displayOptions.value[i]) !== props.noneOptionValue) rank += 1;
    }
    return rank <= 9 ? rank : undefined;
  }
  if (index < 9) return index + 1;
  return index === 9 ? 0 : undefined;
}

function searchInputElement(): HTMLInputElement | null | undefined {
  return searchField.value?.querySelector("input");
}

function scrollPopoverToElement(scrollToEl?: HTMLElement, dir?: "down" | "up"): void {
  if (!scrollToEl && props.scrollToSelected && list.value) {
    const checkedEl = list.value.querySelector("input[checked]");
    const labelEl = checkedEl?.closest("label");
    labelEl?.scrollIntoView({ block: "center" });
    return;
  }
  if (!scrollToEl || !list.value) return;
  const scrollEl = scrollToEl.closest(".overflow-auto");
  if (!(scrollEl instanceof HTMLElement)) return;
  if (dir === "up") {
    if (scrollEl.scrollTop > scrollToEl.offsetTop) {
      scrollToEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }
  if (scrollEl.scrollTop + scrollEl.offsetHeight < scrollToEl.offsetTop) {
    scrollToEl.scrollIntoView({ behavior: "smooth", block: "end" });
  }
}

function selectAt(index: number): void {
  const option = displayOptions.value[index];
  if (!option) return;
  onChangeInternal(option, props.multiple ? !optionSelected(option) : true);
}

function onKeydown(event: KeyboardEvent): void {
  if (device.mobile) return;
  if (!open.value) return;

  // Numeric quick-pick: 0-9 selects the corresponding option. Skipped while the search input is
  // focused so digits can be typed.
  if (
    props.keyboardHints &&
    /^[0-9]$/.test(event.key) &&
    document.activeElement !== searchInputElement()
  ) {
    event.preventDefault();
    const digit = Number(event.key);
    let targetIndex = -1;
    if (props.noneOptionValue !== undefined) {
      if (digit === 0) {
        targetIndex = displayOptions.value.findIndex(
          (option) => optionValue(option) === props.noneOptionValue,
        );
      } else {
        let rank = 0;
        for (let i = 0; i < displayOptions.value.length; i += 1) {
          if (optionValue(displayOptions.value[i]) !== props.noneOptionValue) {
            rank += 1;
            if (rank === digit) {
              targetIndex = i;
              break;
            }
          }
        }
      }
    } else {
      targetIndex = digit === 0 ? 9 : digit - 1;
    }
    if (targetIndex >= 0 && targetIndex < displayOptions.value.length) selectAt(targetIndex);
    return;
  }

  if (!["ArrowDown", "ArrowUp", "Enter", "Tab", " "].includes(event.key)) return;

  const maxIndex = displayOptions.value.length - 1;
  let newIndex = selectedItemIndex.value;
  if (selectedItemIndex.value < 0) newIndex = displayOptions.value.findIndex(optionSelected);
  let dir: "down" | "up" | undefined;

  if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
    dir = "up";
    newIndex -= 1;
    event.preventDefault();
    if (newIndex < 0) {
      dir = "down";
      newIndex = maxIndex;
    }
  }
  if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
    dir = "down";
    newIndex += 1;
    event.preventDefault();
    if (newIndex > maxIndex) {
      dir = "up";
      newIndex = 0;
    }
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Tab") {
    selectedItemIndex.value = newIndex;
    nextTick(() => {
      const element = list.value?.querySelectorAll<HTMLElement>(".cui-list label")[newIndex];
      if (!element) return;
      element.focus();
      scrollPopoverToElement(element, dir);
    });
  }
  if ((event.key === "Enter" || event.key === " ") && selectedItemIndex.value >= 0) {
    if (document.activeElement === searchInputElement()) return;
    event.preventDefault();
    selectAt(selectedItemIndex.value);
  }
}

function onTriggerClick(event: MouseEvent): void {
  emit("click", event);
  open.value = !open.value;
}

function onPopoverOpen(): void {
  emit("opening");
  scrollPopoverToElement();
}

function onPopoverOpened(): void {
  emit("opened");
  if (!props.searchFocus) return;
  if (device.ios || device.android) return;
  nextTick(() => searchInputElement()?.focus());
}

function onPopoverClosed(): void {
  selectedItemIndex.value = -1;
  if (!device.mobile) triggerElement.value?.focus();
  emit("closed");
}

function setTriggerElement(value: unknown): void {
  const element =
    value instanceof HTMLElement
      ? value
      : value && typeof value === "object" && "$el" in value
        ? ((value as { $el: unknown }).$el as HTMLElement)
        : undefined;
  triggerElement.value = element instanceof HTMLElement ? element : undefined;
}

watch(query, (value) => emit("search", value));
watch(open, (value) => {
  if (value) query.value = "";
});

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Button
    v-if="!props.anchorElement"
    v-bind="triggerAttrs"
    :ref="setTriggerElement"
    :accent="props.accent"
    :aria-activedescendant="
      open && selectedItemIndex >= 0 ? `${optionIdPrefix}-${selectedItemIndex}` : undefined
    "
    :aria-controls="open ? listboxId : undefined"
    :aria-disabled="props.disabled || undefined"
    :aria-expanded="open"
    aria-haspopup="listbox"
    :aria-readonly="props.readOnly || undefined"
    :class="triggerClass"
    :color="props.color"
    :content-class-name="triggerContentClass"
    data-part="trigger"
    :disabled="props.disabled"
    :focused="props.focused"
    :hoverable="props.hoverable"
    :multiline="props.multiline"
    :outline="props.outline"
    :pressed="props.pressed"
    :read-only="props.readOnly"
    role="combobox"
    :rounded="props.rounded"
    :size="props.size"
    :surface="props.surface"
    :tight-focus-ring="props.tightFocusRing"
    :variant="props.variant"
    @click="onTriggerClick"
  >
    <div v-if="$slots.icon" :class="iconClass" data-part="icon">
      <slot name="icon" />
    </div>
    <div :class="valueClass" data-part="value">
      <slot :selected="selectedOptions" :value="model">{{
        triggerValue || props.placeholder
      }}</slot>
    </div>
    <slot v-if="props.dropdownIcon" name="dropdownIcon">
      <SelectDropdownIcon :class="selectDropdownIconClasses" data-part="dropdown-icon" />
    </slot>
  </Button>

  <Popover
    v-if="!props.readOnly && !props.disabled"
    v-model:open="open"
    :accent="props.popoverAccent"
    :anchor-element="props.anchorElement ?? triggerElement"
    :class="popoverClass"
    :offset="props.popoverOffset"
    :position="props.popoverPosition"
    :surface-level="props.popoverSurfaceLevel"
    @click.stop
    @closed="onPopoverClosed"
    @closing="emit('closing')"
    @opened="onPopoverOpened"
    @opening="onPopoverOpen"
  >
    <SectionTitle v-if="props.title" :class="selectTitleClasses">{{ props.title }}</SectionTitle>
    <Surface
      v-if="props.search"
      :bg-class-name="searchInset ? 'hidden' : undefined"
      :class="searchWrapperClass"
      :content-class-name="searchWrapperContentClass"
      :level="searchInset ? '+0' : '+1'"
      :wrap-content="!searchInset"
    >
      <SearchField
        ref="searchField"
        v-model="query"
        :class="searchFieldClass"
        :placeholder="props.searchPlaceholder"
      />
    </Surface>
    <slot name="beforeOptions" />
    <List
      :id="listboxId"
      ref="list"
      :aria-multiselectable="props.multiple || undefined"
      role="listbox"
    >
      <div
        v-if="props.search && props.searchFilter && query && !displayOptions.length"
        :class="selectEmptyClasses"
        data-part="empty"
      >
        <slot name="empty" :query="query">{{ props.searchNotFound }}</slot>
      </div>
      <template v-for="(option, optionIndex) in displayOptions" :key="options.indexOf(option)">
        <slot name="beforeOption" :index="optionIndex" :value="option" />
        <ListButton
          :id="`${optionIdPrefix}-${optionIndex}`"
          :aria-disabled="optionDisabled(option) || undefined"
          :aria-selected="optionSelected(option)"
          as="label"
          :content-class-name="selectOptionContentClasses"
          :disabled="optionDisabled(option)"
          :outline="false"
          role="option"
          rounded
          :selected="optionIndex === selectedItemIndex"
        >
          <div :class="selectOptionRowClasses">
            <component
              :is="props.multiple ? Checkbox : Radio"
              as="div"
              :checked="optionSelected(option)"
              :class="selectOptionIndicatorClasses"
              :color="indicatorAccent(option, optionIndex)"
              :disabled="optionDisabled(option)"
              :focusable="false"
              :hoverable="false"
              :input="!optionDisabled(option)"
              @change="(checked: boolean) => onChangeInternal(option, checked)"
            />
            <div :class="selectOptionCopyClasses">
              <slot name="option" v-bind="optionParams(option, optionIndex)">{{
                optionLabel(option, optionIndex)
              }}</slot>
              <div
                v-if="$slots.optionInfo || optionInfo(option, optionIndex)"
                :class="selectOptionInfoClasses"
              >
                <slot name="optionInfo" v-bind="optionParams(option, optionIndex)">{{
                  optionInfo(option, optionIndex)
                }}</slot>
              </div>
            </div>
            <Shortcut
              v-if="showHints && hintFor(option, optionIndex) !== undefined"
              :class="selectHintClasses"
              :key-class-name="hintKeyClass"
              :outline="props.keyboardHintsOutline"
              :size="props.keyboardHintsSize"
              :variant="props.keyboardHintsVariant"
              >{{ hintFor(option, optionIndex) }}</Shortcut
            >
          </div>
        </ListButton>
        <slot name="afterOption" :index="optionIndex" :value="option" />
      </template>
    </List>
    <slot name="afterOptions" />
  </Popover>
</template>
