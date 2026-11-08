import { computed, watch } from "vue";
import { toast } from "@/lib/toast";
import { nearbyPhones, type NearbyPhone } from "@/lib/wireless/nearbyPhones";
import { useAdb } from "@/composables/useAdb";
import { useWirelessDiscovery } from "@/composables/useWirelessDiscovery";
import { useDevicesStore } from "@/stores/devices.store";
import { usePairedPhonesStore } from "@/stores/pairedPhones.store";

const POLL_INTERVAL_MS = 5000;
const RETRY_AFTER_MS = 30_000;

/**
 * Reconnects remembered phones that opted in, as soon as they show up on the network. Discovery
 * only runs while at least one phone has automatic reconnection on, and pauses with the window.
 */
export function useWirelessReconnect() {
  const pairedPhones = usePairedPhonesStore();
  const devicesStore = useDevicesStore();
  const { connectDevice } = useAdb();
  const lastAttempt = new Map<string, number>();
  let running = false;

  const active = computed(() => pairedPhones.autoReconnectGuids.size > 0);
  const { services } = useWirelessDiscovery(POLL_INTERVAL_MS, active);

  function candidates(): NearbyPhone[] {
    const now = Date.now();
    return nearbyPhones(services.value, devicesStore.devices).filter(
      (phone) =>
        phone.connectedSerial === null &&
        pairedPhones.autoReconnectGuids.has(phone.guid) &&
        now - (lastAttempt.get(phone.guid) ?? 0) >= RETRY_AFTER_MS,
    );
  }

  async function reconnect(phone: NearbyPhone) {
    lastAttempt.set(phone.guid, Date.now());
    const label = pairedPhones.find(phone.guid)?.label ?? "A paired phone";
    try {
      await connectDevice(phone.host, phone.port);
      await devicesStore.refreshDevices();
      pairedPhones.remember(phone.guid, null);
      toast.info(`${label} reconnected over Wi-Fi`);
    } catch {
      console.warn(`Automatic Wi-Fi reconnect of ${label} failed; it is retried in 30 s`);
    }
  }

  async function sweep() {
    if (running || candidates().length === 0) return;
    running = true;
    try {
      await devicesStore.refreshDevices();
      for (const phone of candidates()) await reconnect(phone);
    } catch (error) {
      console.warn("Automatic Wi-Fi reconnect could not refresh the device list", error);
    } finally {
      running = false;
    }
  }

  watch(services, () => void sweep());
}
