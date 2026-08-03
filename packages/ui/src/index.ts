export {
  overlayPhases,
  surfaceLevels,
  surfaceVariants,
  uiAccents,
  uiSizes,
  uiThemes,
} from "./foundations/contracts.ts";

export type {
  OverlayPhase,
  SurfaceLevel,
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
  UiTheme,
} from "./foundations/contracts.ts";

export { clampSurfaceLevel, resolveSurfaceLevel } from "./foundations/surfaceLevel.ts";
export { useSurface } from "./contexts/surfaceContext.ts";
export { useUiContext } from "./contexts/uiContext.ts";
export { default as UiProvider } from "./components/provider/UiProvider.vue";
export { default as Surface } from "./components/surface/Surface.vue";
export { default as SurfaceCut } from "./components/surface/SurfaceCut.vue";
export { default as Button } from "./components/actions/Button.vue";
export { buttonSpinnerSizes } from "./components/actions/button.contracts.ts";
export type { ButtonSurface } from "./components/actions/button.contracts.ts";
export { default as Chip } from "./components/data-display/Chip.vue";
export { default as Shortcut } from "./components/data-display/Shortcut.vue";
export { default as Spinner } from "./components/feedback/Spinner.vue";
export { default as Checkbox } from "./components/forms/Checkbox.vue";
export { default as Input } from "./components/forms/Input.vue";
export { default as Radio } from "./components/forms/Radio.vue";
export { default as RadioGroup } from "./components/forms/RadioGroup.vue";
export { default as Slider } from "./components/forms/Slider.vue";
export { default as Select } from "./components/forms/Select.vue";
export type {
  SelectOption,
  SelectOptionInput,
  SelectOptionParams,
  SelectProps,
  SelectValue,
} from "./components/forms/select.contracts.ts";
export { default as Switch } from "./components/forms/Switch.vue";
export { default as Textarea } from "./components/forms/Textarea.vue";
export {
  choiceSizes,
  fieldSizes,
  sliderVariants,
  switchSizes,
} from "./components/forms/form.contracts.ts";
export { default as Dialog } from "./components/overlays/Dialog.vue";
export { default as Popover } from "./components/overlays/Popover.vue";
export { default as Tooltip } from "./components/overlays/Tooltip.vue";
export {
  popoverPositionConfigs,
  popoverPositions,
  tooltipPositions,
} from "./components/overlays/overlay.contracts.ts";
export type {
  OverlayOffsetValue,
  PopoverOffset,
  PopoverPosition,
  TooltipPosition,
} from "./components/overlays/overlay.contracts.ts";
export type {
  ChoiceSize,
  FieldSize,
  SliderScale,
  SliderVariant,
  SwitchSize,
} from "./components/forms/form.contracts.ts";
