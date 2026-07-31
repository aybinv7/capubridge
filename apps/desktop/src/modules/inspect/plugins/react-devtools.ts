import { Atom } from "lucide-vue-next";
import { registerInspectPlugin } from "./registry";
import { REACT_FIBER_KEY_PATTERN } from "../react-devtools/capability";

registerInspectPlugin({
  id: "react-devtools",
  name: "React",
  icon: Atom,
  routeName: "inspect-react",
  routeSegment: "react",
  component: async () => (await import("../ReactDevtoolsPanel.vue")).default,
  // React never creates __REACT_DEVTOOLS_GLOBAL_HOOK__ itself — DevTools does —
  // so detect the fiber back-references react-dom attaches to DOM nodes.
  detect: async (evaluate) => {
    const result = await evaluate(`(() => {
      const fiberKey = ${REACT_FIBER_KEY_PATTERN.toString()};
      const elements = document.querySelectorAll("*");
      const limit = Math.min(elements.length, 3000);
      for (let index = 0; index < limit; index += 1) {
        const keys = Object.keys(elements[index]);
        for (let k = 0; k < keys.length; k += 1) {
          if (fiberKey.test(keys[k])) return true;
        }
      }
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      return Boolean(hook && hook.renderers && hook.renderers.size > 0);
    })()`);
    return result === true;
  },
});
