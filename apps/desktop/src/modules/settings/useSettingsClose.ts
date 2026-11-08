import { useRouter } from "vue-router";

/**
 * Leaves Settings the way it was entered: back through history when there is one, otherwise to
 * the device workspace. `then` runs after the route has changed, for actions that open
 * something else (the Device manager) once Settings is gone.
 */
export function useSettingsClose() {
  const router = useRouter();

  async function close(then?: () => void) {
    const state = window.history.state as { back?: string | null } | null;
    if (state?.back) {
      const left = new Promise<void>((resolve) => {
        const stop = router.afterEach(() => {
          stop();
          resolve();
        });
      });
      router.back();
      await left;
    } else {
      await router.push("/devices");
    }
    then?.();
  }

  return { close };
}
