import type { ButtonDefaultProps } from "../components/actions/button.contracts.ts";
import type {
  SegmentedButtonDefaultProps,
  SegmentedDefaultProps,
} from "../components/actions/segmented.contracts.ts";
import type {
  ToolbarButtonDefaultProps,
  ToolbarDefaultProps,
} from "../components/actions/toolbar.contracts.ts";
import type {
  ToggleButtonDefaultProps,
  ToggleGroupDefaultProps,
} from "../components/actions/toggleGroup.contracts.ts";
import type {
  ChipDefaultProps,
  ListButtonDefaultProps,
  ListDefaultProps,
  ListItemDefaultProps,
  ListSeparatorDefaultProps,
  ListTitleDefaultProps,
  SectionTitleDefaultProps,
  ShortcutDefaultProps,
} from "../components/data-display/dataDisplay.contracts.ts";
import type {
  FocusRingDefaultProps,
  SpinnerDefaultProps,
  ToastDefaultProps,
} from "../components/feedback/feedback.contracts.ts";
import type { CheckboxDefaultProps } from "../components/forms/checkbox.contracts.ts";
import type { InputDefaultProps } from "../components/forms/input.contracts.ts";
import type {
  RadioDefaultProps,
  RadioGroupDefaultProps,
} from "../components/forms/radio.contracts.ts";
import type { SearchFieldDefaultProps } from "../components/forms/searchField.contracts.ts";
import type { SelectDefaultProps } from "../components/forms/select.contracts.ts";
import type { SliderDefaultProps } from "../components/forms/slider.contracts.ts";
import type { SwitchDefaultProps } from "../components/forms/switch.contracts.ts";
import type { TextareaDefaultProps } from "../components/forms/textarea.contracts.ts";
import type {
  DialogDefaultProps,
  PopoverDefaultProps,
  TooltipDefaultProps,
  TooltipPrimitiveDefaultProps,
} from "../components/overlays/overlay.contracts.ts";
import type {
  PopupContentDefaultProps,
  PopupDefaultProps,
} from "../components/overlays/popup.contracts.ts";
import type {
  TabDefaultProps,
  TabPanelDefaultProps,
  TabsDefaultProps,
  TabsListDefaultProps,
} from "../components/navigation/tabs.contracts.ts";
import type {
  AccordionItemDefaultProps,
  AccordionRootDefaultProps,
} from "../components/disclosure/accordion.contracts.ts";
import type {
  CollapsibleIndicatorDefaultProps,
  CollapsiblePanelDefaultProps,
  CollapsibleRootDefaultProps,
} from "../components/disclosure/collapsible.contracts.ts";
import type {
  SurfaceCutDefaultProps,
  SurfaceDefaultProps,
} from "../components/surface/surface.contracts.ts";

/**
 * Registry of per-component default props that can be supplied to `UiProvider` via the `defaults`
 * prop — upstream's `ComponentDefaults` on `CladdProvider`.
 *
 * Each entry is a partial of that component's props, with polymorphic and per-instance props
 * excluded (see each component's `*DefaultProps` type). Explicit props on an instance always win
 * over these defaults, which in turn win over the component's built-in defaults.
 *
 * Add entries here as components opt into context defaults.
 */
export interface ComponentDefaults {
  AccordionItem?: AccordionItemDefaultProps;
  AccordionRoot?: AccordionRootDefaultProps;
  Button?: ButtonDefaultProps;
  Checkbox?: CheckboxDefaultProps;
  Chip?: ChipDefaultProps;
  CollapsibleIndicator?: CollapsibleIndicatorDefaultProps;
  CollapsiblePanel?: CollapsiblePanelDefaultProps;
  CollapsibleRoot?: CollapsibleRootDefaultProps;
  Dialog?: DialogDefaultProps;
  FocusRing?: FocusRingDefaultProps;
  Input?: InputDefaultProps;
  List?: ListDefaultProps;
  ListButton?: ListButtonDefaultProps;
  ListItem?: ListItemDefaultProps;
  ListSeparator?: ListSeparatorDefaultProps;
  ListTitle?: ListTitleDefaultProps;
  Popover?: PopoverDefaultProps;
  Popup?: PopupDefaultProps;
  PopupContent?: PopupContentDefaultProps;
  Radio?: RadioDefaultProps;
  RadioGroup?: RadioGroupDefaultProps;
  SearchField?: SearchFieldDefaultProps;
  SectionTitle?: SectionTitleDefaultProps;
  Segmented?: SegmentedDefaultProps;
  SegmentedButton?: SegmentedButtonDefaultProps;
  Select?: SelectDefaultProps;
  Shortcut?: ShortcutDefaultProps;
  Slider?: SliderDefaultProps;
  Spinner?: SpinnerDefaultProps;
  Surface?: SurfaceDefaultProps;
  SurfaceCut?: SurfaceCutDefaultProps;
  Switch?: SwitchDefaultProps;
  Tab?: TabDefaultProps;
  TabPanel?: TabPanelDefaultProps;
  Tabs?: TabsDefaultProps;
  TabsList?: TabsListDefaultProps;
  Textarea?: TextareaDefaultProps;
  Toast?: ToastDefaultProps;
  ToggleButton?: ToggleButtonDefaultProps;
  ToggleGroup?: ToggleGroupDefaultProps;
  Toolbar?: ToolbarDefaultProps;
  ToolbarButton?: ToolbarButtonDefaultProps;
  Tooltip?: TooltipDefaultProps;
  TooltipPrimitive?: TooltipPrimitiveDefaultProps;
}
