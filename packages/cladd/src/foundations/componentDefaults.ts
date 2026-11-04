import type {
  CalendarDefaultProps,
  DatePickerDefaultProps,
} from '../calendar/calendar.contracts.ts';
import type {
  AccordionItemDefaultProps,
  AccordionRootDefaultProps,
} from '../components/accordion.contracts.ts';
import type { ButtonDefaultProps } from '../components/button.contracts.ts';
import type { CheckboxDefaultProps } from '../components/checkbox.contracts.ts';
import type {
  CollapsibleIndicatorDefaultProps,
  CollapsiblePanelDefaultProps,
  CollapsibleRootDefaultProps,
} from '../components/collapsible.contracts.ts';
import type { ColorEditorDefaultProps } from '../components/colorEditor.contracts.ts';
import type { ColorPickerDefaultProps } from '../components/colorPicker.contracts.ts';
import type {
  ChipDefaultProps,
  ListButtonDefaultProps,
  ListDefaultProps,
  ListItemDefaultProps,
  ListSeparatorDefaultProps,
  ListTitleDefaultProps,
  SectionTitleDefaultProps,
  ShortcutDefaultProps,
} from '../components/dataDisplay.contracts.ts';
import type {
  FocusRingDefaultProps,
  SpinnerDefaultProps,
  ToastDefaultProps,
} from '../components/feedback.contracts.ts';
import type {
  FieldDefaultProps,
  FieldDescriptionDefaultProps,
  FieldErrorDefaultProps,
  FieldGroupDefaultProps,
  FieldLabelDefaultProps,
  FieldLegendDefaultProps,
  FieldSetDefaultProps,
} from '../components/field.contracts.ts';
import type { InputDefaultProps } from '../components/input.contracts.ts';
import type {
  InputGroupAddonDefaultProps,
  InputGroupButtonDefaultProps,
  InputGroupDefaultProps,
  InputGroupInputDefaultProps,
  InputGroupTextareaDefaultProps,
} from '../components/inputGroup.contracts.ts';
import type { LinkDefaultProps } from '../components/link.contracts.ts';
import type { NumberFieldDefaultProps } from '../components/numberField.contracts.ts';
import type { NumberScrubberDefaultProps } from '../components/numberScrubber.contracts.ts';
import type {
  OTPFieldDefaultProps,
  OTPFieldInputDefaultProps,
  OTPFieldSeparatorDefaultProps,
} from '../components/otpField.contracts.ts';
import type {
  BackdropDefaultProps,
  DialogDefaultProps,
  PopoverDefaultProps,
  TooltipDefaultProps,
  TooltipPrimitiveDefaultProps,
} from '../components/overlay.contracts.ts';
import type {
  PopupContentDefaultProps,
  PopupDefaultProps,
} from '../components/popup.contracts.ts';
import type { RadioDefaultProps } from '../components/radio.contracts.ts';
import type { SearchFieldDefaultProps } from '../components/searchField.contracts.ts';
import type {
  SegmentedButtonDefaultProps,
  SegmentedDefaultProps,
} from '../components/segmented.contracts.ts';
import type { SelectDefaultProps } from '../components/select.contracts.ts';
import type { SliderDefaultProps } from '../components/slider.contracts.ts';
import type {
  SurfaceContentDefaultProps,
  SurfaceCutContentDefaultProps,
  SurfaceCutDefaultProps,
  SurfaceDefaultProps,
} from '../components/surface.contracts.ts';
import type { SwitchDefaultProps } from '../components/switch.contracts.ts';
import type {
  TableBodyDefaultProps,
  TableCaptionDefaultProps,
  TableCellDefaultProps,
  TableDefaultProps,
  TableFooterDefaultProps,
  TableHeadDefaultProps,
  TableHeaderDefaultProps,
  TableRowDefaultProps,
} from '../components/table.contracts.ts';
import type {
  TabDefaultProps,
  TabPanelDefaultProps,
  TabsDefaultProps,
  TabsListDefaultProps,
} from '../components/tabs.contracts.ts';
import type { TextareaDefaultProps } from '../components/textarea.contracts.ts';
import type {
  ToggleButtonDefaultProps,
  ToggleGroupDefaultProps,
} from '../components/toggleGroup.contracts.ts';
import type {
  ToolbarButtonDefaultProps,
  ToolbarDefaultProps,
  ToolbarSeparatorDefaultProps,
} from '../components/toolbar.contracts.ts';

/**
 * Registry of per-component default props that can be supplied to `CladdProvider` via the `defaults`
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
  Backdrop?: BackdropDefaultProps;
  Button?: ButtonDefaultProps;
  Checkbox?: CheckboxDefaultProps;
  Chip?: ChipDefaultProps;
  CollapsibleIndicator?: CollapsibleIndicatorDefaultProps;
  CollapsiblePanel?: CollapsiblePanelDefaultProps;
  CollapsibleRoot?: CollapsibleRootDefaultProps;
  Dialog?: DialogDefaultProps;
  FocusRing?: FocusRingDefaultProps;
  Field?: FieldDefaultProps;
  FieldDescription?: FieldDescriptionDefaultProps;
  FieldError?: FieldErrorDefaultProps;
  FieldGroup?: FieldGroupDefaultProps;
  FieldLabel?: FieldLabelDefaultProps;
  FieldLegend?: FieldLegendDefaultProps;
  FieldSet?: FieldSetDefaultProps;
  Input?: InputDefaultProps;
  InputGroup?: InputGroupDefaultProps;
  InputGroupAddon?: InputGroupAddonDefaultProps;
  InputGroupButton?: InputGroupButtonDefaultProps;
  InputGroupInput?: InputGroupInputDefaultProps;
  InputGroupTextarea?: InputGroupTextareaDefaultProps;
  List?: ListDefaultProps;
  ListButton?: ListButtonDefaultProps;
  ListItem?: ListItemDefaultProps;
  ListSeparator?: ListSeparatorDefaultProps;
  ListTitle?: ListTitleDefaultProps;
  Popover?: PopoverDefaultProps;
  Popup?: PopupDefaultProps;
  PopupContent?: PopupContentDefaultProps;
  Radio?: RadioDefaultProps;
  SearchField?: SearchFieldDefaultProps;
  SectionTitle?: SectionTitleDefaultProps;
  Segmented?: SegmentedDefaultProps;
  SegmentedButton?: SegmentedButtonDefaultProps;
  Select?: SelectDefaultProps;
  Shortcut?: ShortcutDefaultProps;
  Slider?: SliderDefaultProps;
  Spinner?: SpinnerDefaultProps;
  Calendar?: CalendarDefaultProps;
  ColorEditor?: ColorEditorDefaultProps;
  DatePicker?: DatePickerDefaultProps;
  ColorPicker?: ColorPickerDefaultProps;
  Link?: LinkDefaultProps;
  NumberField?: NumberFieldDefaultProps;
  NumberScrubber?: NumberScrubberDefaultProps;
  OTPField?: OTPFieldDefaultProps;
  OTPFieldInput?: OTPFieldInputDefaultProps;
  OTPFieldSeparator?: OTPFieldSeparatorDefaultProps;
  Surface?: SurfaceDefaultProps;
  SurfaceContent?: SurfaceContentDefaultProps;
  SurfaceCut?: SurfaceCutDefaultProps;
  SurfaceCutContent?: SurfaceCutContentDefaultProps;
  Switch?: SwitchDefaultProps;
  Table?: TableDefaultProps;
  TableBody?: TableBodyDefaultProps;
  TableCaption?: TableCaptionDefaultProps;
  TableCell?: TableCellDefaultProps;
  TableFooter?: TableFooterDefaultProps;
  TableHead?: TableHeadDefaultProps;
  TableHeader?: TableHeaderDefaultProps;
  TableRow?: TableRowDefaultProps;
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
  ToolbarSeparator?: ToolbarSeparatorDefaultProps;
  Tooltip?: TooltipDefaultProps;
  TooltipPrimitive?: TooltipPrimitiveDefaultProps;
}
