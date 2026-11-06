import { defineAsyncComponent, defineComponent, h } from "vue";
import DataState from "@/modules/storage/frame/DataState.vue";

const CHUNK_RETRIES = 2;

const DiagramLoading = defineComponent({
  name: "DiagramLoading",
  render: () => h(DataState, { kind: "loading", title: "Loading the Diagram" }),
});

const DiagramLoadFailed = defineComponent({
  name: "DiagramLoadFailed",
  props: { error: { type: Error, default: null } },
  setup(props) {
    return () =>
      h(DataState, {
        kind: "error",
        title: "The Diagram could not load",
        text: "It was fetched three times. Try again reloads Capubridge.",
        detail: props.error?.message ?? null,
        onRetry: () => window.location.reload(),
      });
  },
});

/**
 * The Diagram view, loaded with Vue Flow and ELK in its own chunk the first time it is shown.
 * Its chunk says it is loading, is fetched again twice when it fails, then says it failed
 * (B8), instead of leaving the area blank.
 */
export const DiagramViewAsync = defineAsyncComponent({
  loader: () => import("./DiagramView.vue"),
  loadingComponent: DiagramLoading,
  errorComponent: DiagramLoadFailed,
  delay: 150,
  onError(_error, retry, fail, attempts) {
    if (attempts <= CHUNK_RETRIES) retry();
    else fail();
  },
});
