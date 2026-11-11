import { REACT_FIBER_KEY_PATTERN } from "./react-devtools/capability";

export type Framework = "vue" | "react";

export const FRAMEWORK_NAMES: Record<Framework, string> = { vue: "Vue", react: "React" };

/**
 * Whether the page runs each framework, judged from what the running app leaves behind: Vue's
 * app and DOM back-references, React's fiber keys on DOM nodes (React never creates its DevTools
 * hook itself). Each expression evaluates to `true` or `false` in the page.
 */
export const FRAMEWORK_DETECTION: Record<Framework, string> = {
  vue: `(() => {
    if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__?.apps?.length) return true;
    if (window.__VUE__ || window.__NUXT__) return true;
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode;
    while (current) {
      if ("__vue_app__" in current || "__vueParentComponent" in current || "__vnode" in current) {
        return true;
      }
      current = walker.nextNode();
    }
    return false;
  })()`,
  react: `(() => {
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
  })()`,
};
