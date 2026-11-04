export { type Color } from './types.ts';

export type { SurfaceVariant } from './foundations/contracts.ts';

export { useSurface } from './contexts/surfaceContext.ts';
export {
  useCollapsibleContext,
  type CollapsibleContextValue,
} from './components/collapsibleContext.ts';
export { useAccentColor, useTheme } from './contexts/uiContext.ts';
export { useComponentDefaults } from './composables/useComponentDefaults.ts';
export { useDevice } from './composables/useDevice.ts';
export { useDialog } from './composables/useDialog.ts';
export type {
  DialogApi,
  UseDialogAlertOptions,
  UseDialogConfirmOptions,
  UseDialogOptions,
} from './composables/useDialog.ts';
export { useToast } from './composables/useToast.ts';
export type { UseToastOptions } from './composables/useToast.ts';
export { default as Toast } from './components/Toast.vue';
export { default as ToastClose } from './components/ToastClose.vue';
export { default as ToastRoot } from './components/ToastRoot.vue';
export { default as ToastTrigger } from './components/ToastTrigger.vue';
export type { ComponentDefaults } from './foundations/componentDefaults.ts';
export { default as CladdProvider } from './components/CladdProvider.vue';
export { default as Surface } from './components/Surface.vue';
export { default as SurfaceContent } from './components/SurfaceContent.vue';
export { default as SurfaceContextProvider } from './components/SurfaceContextProvider.vue';
export { default as SurfaceCut } from './components/SurfaceCut.vue';
export { default as SurfaceCutContent } from './components/SurfaceCutContent.vue';
export { default as ColorEditor } from './components/ColorEditor.vue';
export type {
  ColorEditorProps,
  ColorEditorDefaultProps,
  ColorEditorControlSize,
  ColorEditorFormat,
} from './components/colorEditor.contracts.ts';
export type {
  ColorEditorValue,
  ColorInput,
  ColorValue,
  GradientInput,
  GradientStop,
  GradientStopInput,
  GradientValue,
  HSB,
  HSL,
  RGB,
  SolidValue,
} from './shared/color.ts';
export { default as ColorPicker } from './components/ColorPicker.vue';
export type {
  ColorPickerProps,
  ColorPickerDefaultProps,
} from './components/colorPicker.contracts.ts';
export { default as Link } from './components/Link.vue';
export { default as NumberField } from './components/NumberField.vue';
export type {
  NumberFieldProps,
  NumberFieldDefaultProps,
  NumberFieldSize,
} from './components/numberField.contracts.ts';
export { default as NumberScrubber } from './components/NumberScrubber.vue';
export type {
  NumberScrubberProps,
  NumberScrubberDefaultProps,
  NumberScrubberSize,
} from './components/numberScrubber.contracts.ts';
export { default as OTPField } from './components/OTPField.vue';
export { default as OTPFieldInput } from './components/OTPFieldInput.vue';
export { default as OTPFieldSeparator } from './components/OTPFieldSeparator.vue';
export type {
  OTPFieldProps,
  OTPFieldDefaultProps,
  OTPFieldInputProps,
  OTPFieldInputDefaultProps,
  OTPFieldSeparatorProps,
  OTPFieldSeparatorDefaultProps,
} from './components/otpField.contracts.ts';
export type {
  LinkProps,
  LinkDefaultProps,
} from './components/link.contracts.ts';
export type {
  SurfaceContentProps,
  SurfaceContentDefaultProps,
  SurfaceCutContentProps,
  SurfaceCutContentDefaultProps,
} from './components/surface.contracts.ts';
export { default as Button } from './components/Button.vue';
export { default as Segmented } from './components/Segmented.vue';
export { default as SegmentedButton } from './components/SegmentedButton.vue';
export { default as Toolbar } from './components/Toolbar.vue';
export { default as ToolbarButton } from './components/ToolbarButton.vue';
export { default as ToolbarSeparator } from './components/ToolbarSeparator.vue';
export { default as ToggleGroup } from './components/ToggleGroup.vue';
export { default as ToggleButton } from './components/ToggleButton.vue';
export { default as Tab } from './components/Tab.vue';
export { default as TabPanel } from './components/TabPanel.vue';
export { default as Tabs } from './components/Tabs.vue';
export { default as TabsList } from './components/TabsList.vue';
export { default as CollapsibleRoot } from './components/CollapsibleRoot.vue';
export { default as CollapsibleTrigger } from './components/CollapsibleTrigger.vue';
export { default as CollapsiblePanel } from './components/CollapsiblePanel.vue';
export { default as CollapsibleIndicator } from './components/CollapsibleIndicator.vue';
export type { CollapsibleIndicatorState } from './components/collapsible.contracts.ts';
export { default as AccordionRoot } from './components/AccordionRoot.vue';
export { default as AccordionItem } from './components/AccordionItem.vue';
export { default as AccordionTrigger } from './components/CollapsibleTrigger.vue';
export { default as AccordionPanel } from './components/CollapsiblePanel.vue';
export { default as AccordionIndicator } from './components/CollapsibleIndicator.vue';
export { default as Chip } from './components/Chip.vue';
export { default as List } from './components/List.vue';
export { default as ListButton } from './components/ListButton.vue';
export { default as ListItem } from './components/ListItem.vue';
export { default as ListSeparator } from './components/ListSeparator.vue';
export { default as ListTitle } from './components/ListTitle.vue';
export { default as SectionTitle } from './components/SectionTitle.vue';
export { default as Shortcut } from './components/Shortcut.vue';
export { default as Spinner } from './components/Spinner.vue';
export { default as Checkbox } from './components/Checkbox.vue';
export { default as Input } from './components/Input.vue';
export { default as Radio } from './components/Radio.vue';
export { default as SearchField } from './components/SearchField.vue';
export { default as Slider } from './components/Slider.vue';
export { default as Select } from './components/Select.vue';
export type {
  SelectOption,
  SelectOptionInput,
  SelectOptionParams,
  SelectProps,
  SelectValue,
} from './components/select.contracts.ts';
export { default as Switch } from './components/Switch.vue';
export { default as Textarea } from './components/Textarea.vue';
export { default as Backdrop } from './components/Backdrop.vue';
export { default as Dialog } from './components/Dialog.vue';
export { default as DialogClose } from './components/DialogClose.vue';
export { default as DialogRoot } from './components/DialogRoot.vue';
export { default as DialogTrigger } from './components/DialogTrigger.vue';
export { default as Popover } from './components/Popover.vue';
export { default as PopoverClose } from './components/PopoverClose.vue';
export { default as PopoverRoot } from './components/PopoverRoot.vue';
export { default as PopoverTrigger } from './components/PopoverTrigger.vue';
export { default as Popup } from './components/Popup.vue';
export { default as PopupClose } from './components/PopupClose.vue';
export { default as PopupContent } from './components/PopupContent.vue';
export { default as PopupRoot } from './components/PopupRoot.vue';
export { default as PopupTrigger } from './components/PopupTrigger.vue';
export { default as Tooltip } from './components/Tooltip.vue';
export { default as TooltipPrimitive } from './components/TooltipPrimitive.vue';
export type {
  PopoverPosition,
  TooltipPosition,
} from './components/overlay.contracts.ts';
export type { SliderVariant } from './components/form.contracts.ts';

export { default as Field } from './components/Field.vue';
export { default as FieldDescription } from './components/FieldDescription.vue';
export { default as FieldError } from './components/FieldError.vue';
export { default as FieldGroup } from './components/FieldGroup.vue';
export { default as FieldLabel } from './components/FieldLabel.vue';
export { default as FieldLegend } from './components/FieldLegend.vue';
export { default as FieldSet } from './components/FieldSet.vue';
export { default as InputGroup } from './components/InputGroup.vue';
export { default as InputGroupAddon } from './components/InputGroupAddon.vue';
export { default as InputGroupButton } from './components/InputGroupButton.vue';
export { default as InputGroupInput } from './components/InputGroupInput.vue';
export { default as InputGroupTextarea } from './components/InputGroupTextarea.vue';
export type {
  FieldDefaultProps,
  FieldDensity,
  FieldDescriptionDefaultProps,
  FieldDescriptionProps,
  FieldErrorDefaultProps,
  FieldErrorProps,
  FieldGroupDefaultProps,
  FieldGroupProps,
  FieldLabelDefaultProps,
  FieldLabelProps,
  FieldLegendDefaultProps,
  FieldLegendProps,
  FieldOrientation,
  FieldProps,
  FieldSetDefaultProps,
  FieldSetProps,
} from './components/field.contracts.ts';
export type {
  InputGroupAddonDefaultProps,
  InputGroupAddonProps,
  InputGroupAddonSide,
  InputGroupButtonDefaultProps,
  InputGroupButtonProps,
  InputGroupDefaultProps,
  InputGroupInputDefaultProps,
  InputGroupInputProps,
  InputGroupProps,
  InputGroupTextareaDefaultProps,
  InputGroupTextareaProps,
} from './components/inputGroup.contracts.ts';

export { default as Table } from './components/Table.vue';
export { default as TableBody } from './components/TableBody.vue';
export { default as TableCaption } from './components/TableCaption.vue';
export { default as TableCell } from './components/TableCell.vue';
export { default as TableFooter } from './components/TableFooter.vue';
export { default as TableHead } from './components/TableHead.vue';
export { default as TableHeader } from './components/TableHeader.vue';
export { default as TableRow } from './components/TableRow.vue';
export type {
  TableBodyDefaultProps,
  TableBodyProps,
  TableCaptionDefaultProps,
  TableCaptionProps,
  TableCellDefaultProps,
  TableCellProps,
  TableColumn,
  TableDefaultProps,
  TableDensity,
  TableFooterDefaultProps,
  TableFooterProps,
  TableHeadDefaultProps,
  TableHeadProps,
  TableHeaderDefaultProps,
  TableHeaderProps,
  TableProps,
  TableRowDefaultProps,
  TableRowProps,
  TableSortDirection,
  TableSortState,
} from './components/table.contracts.ts';

// Upstream declares a size union per component rather than a shared one.
export type { ButtonSize } from './components/button.contracts.ts';
export type { CheckboxSize } from './components/checkbox.contracts.ts';
export type {
  ChipSize,
  ShortcutSize,
} from './components/dataDisplay.contracts.ts';
export type { SpinnerSize } from './components/feedback.contracts.ts';
export type { InputSize } from './components/input.contracts.ts';
export type { RadioSize } from './components/radio.contracts.ts';
export type { SliderSize } from './components/slider.contracts.ts';
export type { SwitchSize } from './components/switch.contracts.ts';
export type { TextareaSize } from './components/textarea.contracts.ts';

export { default as CloseIcon } from './components/icons/CloseIcon.vue';
export { default as SearchIcon } from './components/icons/SearchIcon.vue';
export { default as DropdownIcon } from './components/icons/DropdownIcon.vue';
export { default as CheckIcon } from './components/icons/CheckIcon.vue';

export { cn } from './shared/cn.ts';
export { nextTick } from './shared/nextTick.ts';

// Upstream exports the props type of every component.
export type {
  AccordionItemDefaultProps,
  AccordionItemProps,
  AccordionRootDefaultProps,
  AccordionRootProps,
} from './components/accordion.contracts.ts';
export type {
  ButtonDefaultProps,
  ButtonProps,
} from './components/button.contracts.ts';
export type {
  CheckboxDefaultProps,
  CheckboxProps,
} from './components/checkbox.contracts.ts';
export type {
  CollapsibleIndicatorDefaultProps,
  CollapsibleIndicatorProps,
  CollapsiblePanelDefaultProps,
  CollapsiblePanelProps,
  CollapsibleRootDefaultProps,
  CollapsibleRootProps,
} from './components/collapsible.contracts.ts';
export type {
  ChipDefaultProps,
  ChipProps,
  ListButtonDefaultProps,
  ListButtonProps,
  ListDefaultProps,
  ListItemDefaultProps,
  ListSeparatorDefaultProps,
  ListTitleDefaultProps,
  SectionTitleDefaultProps,
  ShortcutDefaultProps,
  ShortcutProps,
} from './components/dataDisplay.contracts.ts';
export type {
  SpinnerDefaultProps,
  SpinnerProps,
  ToastDefaultProps,
  ToastProps,
} from './components/feedback.contracts.ts';
export type {
  InputDefaultProps,
  InputProps,
} from './components/input.contracts.ts';
export type {
  DialogDefaultProps,
  DialogProps,
  PopoverDefaultProps,
  PopoverProps,
  TooltipDefaultProps,
  TooltipPrimitiveDefaultProps,
  TooltipPrimitiveProps,
  TooltipProps,
} from './components/overlay.contracts.ts';
export type {
  PopupContentDefaultProps,
  PopupContentProps,
  PopupDefaultProps,
  PopupProps,
} from './components/popup.contracts.ts';
export type {
  RadioDefaultProps,
  RadioProps,
} from './components/radio.contracts.ts';
export type {
  SearchFieldDefaultProps,
  SearchFieldProps,
} from './components/searchField.contracts.ts';
export type {
  SegmentedButtonDefaultProps,
  SegmentedButtonProps,
  SegmentedDefaultProps,
  SegmentedProps,
} from './components/segmented.contracts.ts';
export type { SelectDefaultProps } from './components/select.contracts.ts';
export type {
  SliderDefaultProps,
  SliderProps,
} from './components/slider.contracts.ts';
export type {
  SurfaceCutDefaultProps,
  SurfaceCutProps,
  SurfaceDefaultProps,
  SurfaceProps,
} from './components/surface.contracts.ts';
export type {
  SwitchDefaultProps,
  SwitchProps,
} from './components/switch.contracts.ts';
export type {
  TabDefaultProps,
  TabPanelDefaultProps,
  TabPanelProps,
  TabProps,
  TabsDefaultProps,
  TabsListDefaultProps,
  TabsProps,
} from './components/tabs.contracts.ts';
export type {
  TextareaDefaultProps,
  TextareaProps,
} from './components/textarea.contracts.ts';
export type {
  ToggleButtonDefaultProps,
  ToggleGroupDefaultProps,
  ToggleGroupProps,
} from './components/toggleGroup.contracts.ts';
export type {
  ToolbarButtonDefaultProps,
  ToolbarDefaultProps,
  ToolbarProps,
} from './components/toolbar.contracts.ts';

// Upstream exports the props type of every component.
export type { CladdProviderProps } from './components/claddProvider.contracts.ts';
export type { CollapsibleTriggerProps } from './components/collapsible.contracts.ts';
export type { SectionTitleProps } from './components/dataDisplay.contracts.ts';
export type {
  ListItemProps,
  ListProps,
  ListSeparatorProps,
  ListTitleProps,
} from './components/list.contracts.ts';
export type {
  BackdropDefaultProps,
  BackdropProps,
  DialogCloseProps,
  DialogRootProps,
  DialogTriggerProps,
  PopoverCloseProps,
  PopoverRootProps,
  PopoverTriggerProps,
} from './components/overlay.contracts.ts';
export type {
  PopupCloseProps,
  PopupRootProps,
  PopupTriggerProps,
} from './components/popup.contracts.ts';
export type { TabsListProps } from './components/tabs.contracts.ts';
export type {
  ToastCloseProps,
  ToastRootProps,
  ToastTriggerProps,
} from './components/toast.contracts.ts';
export type { ToggleButtonProps } from './components/toggleGroup.contracts.ts';
export type {
  ToolbarButtonProps,
  ToolbarSeparatorDefaultProps,
  ToolbarSeparatorProps,
} from './components/toolbar.contracts.ts';

// Upstream aliases the collapsible primitives under the accordion names.
export type {
  CollapsibleIndicatorProps as AccordionIndicatorProps,
  CollapsibleIndicatorState as AccordionIndicatorState,
  CollapsiblePanelDefaultProps as AccordionPanelDefaultProps,
  CollapsiblePanelProps as AccordionPanelProps,
  CollapsibleTriggerProps as AccordionTriggerProps,
} from './components/collapsible.contracts.ts';
