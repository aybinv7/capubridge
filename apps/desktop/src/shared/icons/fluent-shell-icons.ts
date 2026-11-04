import AppGeneric20Filled from "@vicons/fluent/es/AppGeneric20Filled";
import AppGeneric20Regular from "@vicons/fluent/es/AppGeneric20Regular";
import Beaker20Filled from "@vicons/fluent/es/Beaker20Filled";
import Beaker20Regular from "@vicons/fluent/es/Beaker20Regular";
import ChevronLeft20Regular from "@vicons/fluent/es/ChevronLeft20Regular";
import ChevronRight20Regular from "@vicons/fluent/es/ChevronRight20Regular";
import CursorClick20Filled from "@vicons/fluent/es/CursorClick20Filled";
import CursorClick20Regular from "@vicons/fluent/es/CursorClick20Regular";
import Database20Filled from "@vicons/fluent/es/Database20Filled";
import Database20Regular from "@vicons/fluent/es/Database20Regular";
import Flash20Filled from "@vicons/fluent/es/Flash20Filled";
import Flash20Regular from "@vicons/fluent/es/Flash20Regular";
import Globe20Filled from "@vicons/fluent/es/Globe20Filled";
import Globe20Regular from "@vicons/fluent/es/Globe20Regular";
import PanelBottom20Filled from "@vicons/fluent/es/PanelBottom20Filled";
import PanelBottom20Regular from "@vicons/fluent/es/PanelBottom20Regular";
import PanelLeft20Filled from "@vicons/fluent/es/PanelLeft20Filled";
import PanelLeft20Regular from "@vicons/fluent/es/PanelLeft20Regular";
import PanelRight20Filled from "@vicons/fluent/es/PanelRight20Filled";
import PanelRight20Regular from "@vicons/fluent/es/PanelRight20Regular";
import Phone20Filled from "@vicons/fluent/es/Phone20Filled";
import Phone20Regular from "@vicons/fluent/es/Phone20Regular";
import Replay20Filled from "@vicons/fluent/es/Replay20Filled";
import Replay20Regular from "@vicons/fluent/es/Replay20Regular";
import Search20Regular from "@vicons/fluent/es/Search20Regular";
import Settings20Filled from "@vicons/fluent/es/Settings20Filled";
import Settings20Regular from "@vicons/fluent/es/Settings20Regular";
import type { ShellIconSet } from "./shell-icon.types";

/**
 * Microsoft Fluent UI System Icons (MIT, through `@vicons/fluent`): every glyph is designed as a
 * Regular and Filled pair on a 20 px grid, the size the rail draws at. Imported per file so the
 * dev server never pre-bundles the 20 000 module index.
 */
export const fluentShellIcons: ShellIconSet = {
  name: "Fluent",
  rail: {
    device: { regular: Phone20Regular, filled: Phone20Filled },
    app: { regular: AppGeneric20Regular, filled: AppGeneric20Filled },
    data: { regular: Database20Regular, filled: Database20Filled },
    network: { regular: Globe20Regular, filled: Globe20Filled },
    elements: { regular: CursorClick20Regular, filled: CursorClick20Filled },
    replay: { regular: Replay20Regular, filled: Replay20Filled },
    flows: { regular: Flash20Regular, filled: Flash20Filled },
    preview: { regular: Beaker20Regular, filled: Beaker20Filled },
    settings: { regular: Settings20Regular, filled: Settings20Filled },
  },
  back: ChevronLeft20Regular,
  forward: ChevronRight20Regular,
  search: Search20Regular,
  panelRight: { regular: PanelRight20Regular, filled: PanelRight20Filled },
  panelLeft: { regular: PanelLeft20Regular, filled: PanelLeft20Filled },
  panelBottom: { regular: PanelBottom20Regular, filled: PanelBottom20Filled },
};
