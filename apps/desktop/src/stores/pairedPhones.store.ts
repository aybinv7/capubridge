import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { readPersisted, writePersisted } from "@/lib/persisted";

const STORAGE_KEY = "capubridge.paired-phones.v1";

/**
 * A phone paired over Wi-Fi, remembered by its wireless debugging guid (the mDNS instance
 * name, stable across sessions). No address is stored: discovery finds it each time.
 */
export interface PairedPhone {
  guid: string;
  /** The device name shown when it was last connected ("Google Pixel 8"). */
  label: string | null;
  autoReconnect: boolean;
  lastConnectedAt: number;
}

function isPairedPhone(value: unknown): value is PairedPhone {
  if (typeof value !== "object" || value === null) return false;
  const phone = value as Record<string, unknown>;
  return (
    typeof phone.guid === "string" &&
    (phone.label === null || typeof phone.label === "string") &&
    typeof phone.autoReconnect === "boolean" &&
    typeof phone.lastConnectedAt === "number"
  );
}

function isPairedPhoneList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isPairedPhone);
}

export const usePairedPhonesStore = defineStore("pairedPhones", () => {
  const phones = ref<PairedPhone[]>(
    readPersisted<PairedPhone[]>(STORAGE_KEY, [], isPairedPhoneList),
  );

  const byGuid = computed(() => new Map(phones.value.map((phone) => [phone.guid, phone])));
  const autoReconnectGuids = computed(
    () => new Set(phones.value.filter((phone) => phone.autoReconnect).map((phone) => phone.guid)),
  );

  function save() {
    writePersisted(STORAGE_KEY, phones.value);
  }

  /** Records a phone that just connected; a new phone reconnects automatically by default. */
  function remember(guid: string, label: string | null) {
    const existing = byGuid.value.get(guid);
    const next: PairedPhone = {
      guid,
      label: label ?? existing?.label ?? null,
      autoReconnect: existing?.autoReconnect ?? true,
      lastConnectedAt: Date.now(),
    };
    phones.value = [next, ...phones.value.filter((phone) => phone.guid !== guid)];
    save();
  }

  function setAutoReconnect(guid: string, value: boolean) {
    phones.value = phones.value.map((phone) =>
      phone.guid === guid ? { ...phone, autoReconnect: value } : phone,
    );
    save();
  }

  function forget(guid: string) {
    phones.value = phones.value.filter((phone) => phone.guid !== guid);
    save();
  }

  function find(guid: string): PairedPhone | null {
    return byGuid.value.get(guid) ?? null;
  }

  return { phones, autoReconnectGuids, remember, setAutoReconnect, forget, find };
});
