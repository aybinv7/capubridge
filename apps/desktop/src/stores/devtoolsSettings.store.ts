import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";

const LS_HIDE_SCREENCAST = "capubridge:devtools-hide-screencast";

/** How the docked Chrome DevTools opens. */
export const useDevtoolsSettingsStore = defineStore("devtoolsSettings", () => {
  /**
   * Chrome DevTools draws its own copy of the page beside its panels. The page is already on
   * screen beside DevTools here, so that copy is hidden unless asked for.
   */
  const hideScreencast = ref(
    readPersisted<boolean>(LS_HIDE_SCREENCAST, true, (value) => typeof value === "boolean"),
  );

  watch(hideScreencast, (next) => writePersisted(LS_HIDE_SCREENCAST, next));

  return { hideScreencast };
});
