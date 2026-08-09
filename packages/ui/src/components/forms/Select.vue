<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
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
  closeOnSelect: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  dropdownIcon: undefined,
  focused: undefined,
  getOptionValue: undefined,
  hoverable: undefined,
  iconClassName: undefined,
  indicatorColor: undefined,
  isChecked: undefined,
  isOptionDisabled: undefined,
  keyboardHints: undefined,
  keyboardHintsClassName: undefined,
  keyboardHintsOutline: undefined,
  keyboardHintsSize: undefined,
  keyboardHintsVariant: undefined,
  multiline: undefined,
  multiple: undefined,
  noneOptionValue: undefined,
  optionIndicatorColor: undefined,
  optionInfo: undefined,
  optionLabel: undefined,
  options: undefined,
  outline: undefined,
  placeholder: undefined,
  placeholderClassName: undefined,
  popoverAccent: undefined,
  popoverClassName: undefined,
  popoverOffset: undefined,
  popoverPosition: undefined,
  popoverSurfaceLevel: undefined,
  readOnly: undefined,
  pressed: undefined,
  reverse: undefined,
  rounded: undefined,
  scrollToSelected: undefined,
  search: undefined,
  searchFilter: undefined,
  searchFocus: undefined,
  searchNotFound: undefined,
  searchPlaceholder: undefined,
  size: undefined,
  surface: undefined,
  tightFocusRing: undefined,
  title: undefined,
  valueClassName: undefined,
  variant: undefined,
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
const d = useComponentDefaults("Select", props, {
  closeOnSelect: true,
  disabled: false,
  dropdownIcon: true,
  focused: false,
  hoverable: true,
  keyboardHints: true,
  keyboardHintsOutline: false,
  keyboardHintsSize: "md" as SelectProps["keyboardHintsSize"],
  keyboardHintsVariant: "transparent" as SelectProps["keyboardHintsVariant"],
  multiline: false,
  multiple: false,
  options: [] as SelectProps["options"],
  outline: true,
  placeholder: "",
  popoverOffset: selectPopoverOffset,
  popoverPosition: "bottom-end" as SelectProps["popoverPosition"],
  readOnly: false,
  pressed: false,
  reverse: false,
  rounded: false,
  scrollToSelected: false,
  search: false,
  searchFocus: false,
  searchNotFound: "Nothing found",
  searchPlaceholder: "Search",
  size: "md" as SelectProps["size"],
  surface: "surface" as SelectProps["surface"],
  tightFocusRing: false,
  variant: "gradient" as SelectProps["variant"],
});
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
  d.value.search && d.value.searchFilter ? d.value.searchFilter(query.value) : d.value.options,
);

const selectedOptions = computed(() => d.value.options.filter((option) => optionSelected(option)));

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

const searchInset = computed(() => Boolean(d.value.title));
const showHints = computed(
  () => d.value.keyboardHints && displayOptions.value.length > 1 && !device.mobile,
);

const triggerClass = computed(() => cn(selectTriggerClasses, attrs.class));
const triggerContentClass = computed(() =>
  cn(
    d.value.dropdownIcon && selectTriggerDropdownPaddingClasses,
    selectTriggerContentClasses,
    d.value.reverse && selectTriggerReverseClasses,
    d.value.contentClassName,
  ),
);
const iconClass = computed(() =>
  cn(selectIconClasses, buttonIconSizes[d.value.size], d.value.iconClassName),
);
const valueClass = computed(() =>
  cn(
    selectValueClasses,
    !slots.default && !triggerValue.value && selectPlaceholderClasses,
    d.value.placeholderClassName,
    d.value.valueClassName,
  ),
);
const popoverClass = computed(() => cn(selectPopoverClasses, d.value.popoverClassName));
const searchWrapperClass = computed(() =>
  searchInset.value ? selectSearchInsetWrapperClasses : selectSearchStickyWrapperClasses,
);
const searchWrapperContentClass = computed(() =>
  searchInset.value ? selectSearchInsetWrapperClasses : selectSearchStickyContentClasses,
);
const searchFieldClass = computed(() =>
  cn(selectSearchFieldClasses, searchInset.value && selectSearchFieldInsetClasses),
);
const hintKeyClass = computed(() => cn(selectHintKeyClasses, d.value.keyboardHintsClassName));
const triggerAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

function optionValue(option: SelectOptionInput): SelectValue {
  return d.value.getOptionValue?.(option) ?? getDefaultOptionValue(option);
}

function optionParams(
  option: SelectOptionInput,
  index = d.value.options.indexOf(option),
): SelectOptionParams {
  return { index, selected: optionSelected(option), value: option };
}

function optionLabel(option: SelectOptionInput, index = d.value.options.indexOf(option)): string {
  return d.value.optionLabel?.(optionParams(option, index)) ?? getDefaultOptionLabel(option);
}

function optionInfo(option: SelectOptionInput, index: number): string | undefined {
  return d.value.optionInfo?.(optionParams(option, index)) ?? getDefaultOptionInfo(option);
}

function optionSelected(option: SelectOptionInput): boolean {
  if (d.value.isChecked) return d.value.isChecked(option);
  return selectedValues.value.includes(optionValue(option));
}

function optionDisabled(option: SelectOptionInput): boolean {
  if (d.value.isOptionDisabled) return d.value.isOptionDisabled(option);
  return (
    typeof option === "object" &&
    option !== null &&
    "disabled" in option &&
    option.disabled === true
  );
}

function indicatorAccent(option: SelectOptionInput, index: number) {
  return d.value.optionIndicatorColor?.(optionParams(option, index)) ?? d.value.indicatorColor;
}

function onChangeInternal(option: SelectOptionInput, checked: boolean): void {
  const key = optionValue(option);
  if (!d.value.multiple) {
    model.value = key;
    emit("change", key);
  } else {
    const next = selectedValues.value.filter((value) => value !== "");
    if (checked) next.push(key);
    else if (next.includes(key)) next.splice(next.indexOf(key), 1);
    model.value = next;
    emit("change", next);
  }
  if (!d.value.multiple && d.value.closeOnSelect) open.value = false;
}

function hintFor(option: SelectOptionInput, index: number): number | undefined {
  if (d.value.noneOptionValue !== undefined) {
    if (optionValue(option) === d.value.noneOptionValue) return 0;
    let rank = 0;
    for (let i = 0; i <= index; i += 1) {
      if (optionValue(displayOptions.value[i]) !== d.value.noneOptionValue) rank += 1;
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
  if (!scrollToEl && d.value.scrollToSelected && list.value) {
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
  onChangeInternal(option, d.value.multiple ? !optionSelected(option) : true);
}

function onKeydown(event: KeyboardEvent): void {
  if (device.mobile) return;
  if (!open.value) return;

  // Numeric quick-pick: 0-9 selects the corresponding option. Skipped while the search input is
  // focused so digits can be typed.
  if (
    d.value.keyboardHints &&
    /^[0-9]$/.test(event.key) &&
    document.activeElement !== searchInputElement()
  ) {
    event.preventDefault();
    const digit = Number(event.key);
    let targetIndex = -1;
    if (d.value.noneOptionValue !== undefined) {
      if (digit === 0) {
        targetIndex = displayOptions.value.findIndex(
          (option) => optionValue(option) === d.value.noneOptionValue,
        );
      } else {
        let rank = 0;
        for (let i = 0; i < displayOptions.value.length; i += 1) {
          if (optionValue(displayOptions.value[i]) !== d.value.noneOptionValue) {
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
  if (!d.value.searchFocus) return;
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
    v-if="!d.anchorElement"
    v-bind="triggerAttrs"
    :ref="setTriggerElement"
    :accent="d.accent"
    :aria-activedescendant="
      open && selectedItemIndex >= 0 ? `${optionIdPrefix}-${selectedItemIndex}` : undefined
    "
    :aria-controls="open ? listboxId : undefined"
    :aria-disabled="d.disabled || undefined"
    :aria-expanded="open"
    aria-haspopup="listbox"
    :aria-readonly="d.readOnly || undefined"
    :class="triggerClass"
    :color="d.color"
    :content-class-name="triggerContentClass"
    data-part="trigger"
    :disabled="d.disabled"
    :focused="d.focused"
    :hoverable="d.hoverable"
    :multiline="d.multiline"
    :outline="d.outline"
    :pressed="d.pressed"
    :read-only="d.readOnly"
    role="combobox"
    :rounded="d.rounded"
    :size="d.size"
    :surface="d.surface"
    :tight-focus-ring="d.tightFocusRing"
    :variant="d.variant"
    @click="onTriggerClick"
  >
    <div v-if="$slots.icon" :class="iconClass" data-part="icon">
      <slot name="icon" />
    </div>
    <div :class="valueClass" data-part="value">
      <slot :selected="selectedOptions" :value="model">{{ triggerValue || d.placeholder }}</slot>
    </div>
    <slot v-if="d.dropdownIcon" name="dropdownIcon">
      <SelectDropdownIcon :class="selectDropdownIconClasses" data-part="dropdown-icon" />
    </slot>
  </Button>

  <Popover
    v-if="!d.readOnly && !d.disabled"
    v-model:open="open"
    :accent="d.popoverAccent"
    :anchor-element="d.anchorElement ?? triggerElement"
    :class="popoverClass"
    :offset="d.popoverOffset"
    :position="d.popoverPosition"
    :surface-level="d.popoverSurfaceLevel"
    @click.stop
    @closed="onPopoverClosed"
    @closing="emit('closing')"
    @opened="onPopoverOpened"
    @opening="onPopoverOpen"
  >
    <SectionTitle v-if="d.title" :class="selectTitleClasses">{{ d.title }}</SectionTitle>
    <Surface
      v-if="d.search"
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
        :placeholder="d.searchPlaceholder"
      />
    </Surface>
    <slot name="beforeOptions" />
    <List :id="listboxId" ref="list" :aria-multiselectable="d.multiple || undefined" role="listbox">
      <div
        v-if="d.search && d.searchFilter && query && !displayOptions.length"
        :class="selectEmptyClasses"
        data-part="empty"
      >
        <slot name="empty" :query="query">{{ d.searchNotFound }}</slot>
      </div>
      <template v-for="(option, optionIndex) in displayOptions" :key="d.options.indexOf(option)">
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
              :is="d.multiple ? Checkbox : Radio"
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
              :outline="d.keyboardHintsOutline"
              :size="d.keyboardHintsSize"
              :variant="d.keyboardHintsVariant"
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
