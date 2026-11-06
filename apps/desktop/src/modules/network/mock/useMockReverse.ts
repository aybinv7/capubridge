import { computed, ref } from "vue";
import { toast } from "@/lib/toast";
import { invokeCommand } from "@/runtime/ipc/client";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useMockStore } from "../stores/useMockStore";

/**
 * Makes the phone's `localhost:<port>` reach the mock server on this computer (`adb reverse`),
 * for the phone of the selected target.
 */
export function useMockReverse() {
  const store = useMockStore();
  const targets = useTargetsStore();
  const devices = useDevicesStore();
  const names = useDeviceNamesStore();
  const running = ref(false);

  const serial = computed(() => targets.selectedTarget?.deviceSerial ?? null);
  const phoneName = computed(() => {
    const device = devices.devices.find((candidate) => candidate.serial === serial.value);
    return device ? names.nameOf(device) : "the phone";
  });

  async function connect() {
    const target = serial.value;
    if (!target || running.value) return;
    running.value = true;
    try {
      await invokeCommand("session_reverse", {
        serial: target,
        remotePort: store.httpPort,
        localPort: store.httpPort,
      });
      toast(`${phoneName.value} can reach the mock server`, {
        description: `localhost:${store.httpPort} on the phone now goes to this computer.`,
      });
    } catch (error) {
      toast.error(`Could not connect ${phoneName.value} to the mock server`, {
        description: String(error),
      });
    } finally {
      running.value = false;
    }
  }

  return { serial, running, connect };
}
