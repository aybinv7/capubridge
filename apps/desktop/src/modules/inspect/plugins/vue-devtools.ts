import { Hexagon } from "lucide-vue-next";
import { registerInspectPlugin } from "./registry";

registerInspectPlugin({
  id: "vue-devtools",
  name: "Vue",
  icon: Hexagon,
  detect: async (evaluate) => {
    const result = await evaluate("!!window.__VUE_DEVTOOLS_GLOBAL_HOOK__");
    return result === true;
  },
  component: () => import("./PluginContainer.vue").then((m) => m.default),
});
