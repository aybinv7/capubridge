/**
 * Capubridge VitePress Theme — index.ts
 *
 * Extends default VitePress theme with:
 *  - Capubridge warm-dark palette
 *  - Coral-amber accent (#e87c5a)
 *  - Geist typography
 *  - Codex/Claude-inspired chrome
 *  - 10px border radius throughout
 */
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import ModuleNav from "./ModuleNav.vue";
import AppPreview from "./AppPreview.vue";
import "./style.css";

const CapubridgeTheme: Theme = {
  extends: DefaultTheme,

  enhanceApp({ app }) {
    app.component("ModuleNav", ModuleNav);
    app.component("AppPreview", AppPreview);
  },
};

export default CapubridgeTheme;
