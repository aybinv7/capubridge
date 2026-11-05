import { onScopeDispose, shallowRef, watch, type Ref } from "vue";

/**
 * An object URL for a Blob that lives exactly as long as the Blob is shown: revoked when the Blob
 * changes and when the owning component unmounts, so media never leaks memory between files.
 */
export function useObjectUrl(blob: Ref<Blob | null>) {
  const url = shallowRef<string | null>(null);

  function revoke() {
    if (url.value) URL.revokeObjectURL(url.value);
    url.value = null;
  }

  watch(
    blob,
    (next) => {
      revoke();
      if (next) url.value = URL.createObjectURL(next);
    },
    { immediate: true },
  );

  onScopeDispose(revoke);

  return url;
}
