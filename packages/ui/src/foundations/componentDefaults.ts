import type { ButtonDefaultProps } from "../components/actions/button.contracts.ts";
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
import type { SearchFieldDefaultProps } from "../components/forms/searchField.contracts.ts";
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
  Button?: ButtonDefaultProps;
  Chip?: ChipDefaultProps;
  FocusRing?: FocusRingDefaultProps;
  List?: ListDefaultProps;
  ListButton?: ListButtonDefaultProps;
  ListItem?: ListItemDefaultProps;
  ListSeparator?: ListSeparatorDefaultProps;
  ListTitle?: ListTitleDefaultProps;
  SearchField?: SearchFieldDefaultProps;
  SectionTitle?: SectionTitleDefaultProps;
  Shortcut?: ShortcutDefaultProps;
  Spinner?: SpinnerDefaultProps;
  Surface?: SurfaceDefaultProps;
  SurfaceCut?: SurfaceCutDefaultProps;
  Toast?: ToastDefaultProps;
}
