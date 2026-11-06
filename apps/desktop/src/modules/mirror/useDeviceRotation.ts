import { computed, ref, shallowRef, watch, type Ref } from "vue";
import { toast } from "@/lib/toast";
import { useAdb } from "@/composables/useAdb";
import {
  RotationError,
  createRotationController,
  oppositeOrientation,
  type DeviceOrientation,
  type RotationController,
  type RotationSettings,
} from "./deviceRotation";

interface DeviceRotationOptions {
  serial: Ref<string | null>;
  /** What the stream shows right now; used while auto-rotate is on and the sensor decides. */
  streamOrientation: Ref<DeviceOrientation | null>;
  controller?: RotationController;
}

function describe(error: unknown): { title: string; description?: string } {
  if (error instanceof RotationError) return { title: error.message, description: error.detail };
  return { title: "Could not reach the device to rotate it", description: String(error) };
}

/**
 * The phone column's rotation state for one device: whether Capubridge (or the user) is holding an
 * orientation, which way the next press turns it, and the two actions with their failures shown.
 */
export function useDeviceRotation(options: DeviceRotationOptions) {
  const controller = options.controller ?? createRotationController(useAdb().shellCommand);
  const settings = shallowRef<RotationSettings | null>(null);
  const busy = ref(false);
  let readSequence = 0;

  async function refresh() {
    const serial = options.serial.value;
    const sequence = ++readSequence;
    if (!serial) {
      settings.value = null;
      return;
    }
    try {
      const next = await controller.read(serial);
      if (sequence === readSequence) settings.value = next;
    } catch (error) {
      if (sequence === readSequence) settings.value = null;
      console.warn("Failed to read the device rotation", serial, error);
    }
  }

  watch(options.serial, () => void refresh(), { immediate: true });

  const current = computed<DeviceOrientation>(() => {
    const held = settings.value;
    if (held && !held.autoRotate) return held.userRotation % 2 === 1 ? "landscape" : "portrait";
    return options.streamOrientation.value ?? "portrait";
  });
  const target = computed(() => oppositeOrientation(current.value));
  const locked = computed(() => settings.value?.autoRotate === false);
  const available = computed(() => Boolean(options.serial.value) && settings.value !== null);

  async function perform(action: (serial: string) => Promise<RotationSettings>) {
    const serial = options.serial.value;
    if (!serial || busy.value) return;
    busy.value = true;
    try {
      settings.value = await action(serial);
    } catch (error) {
      const { title, description } = describe(error);
      toast.error(title, { description });
      await refresh();
    } finally {
      busy.value = false;
    }
  }

  function rotate() {
    const now = settings.value ?? { autoRotate: true, userRotation: 0 as const };
    return perform((serial) => controller.hold(serial, target.value, now));
  }

  function restoreAuto() {
    return perform((serial) => controller.restoreAuto(serial));
  }

  return { settings, busy, locked, available, current, target, refresh, rotate, restoreAuto };
}
