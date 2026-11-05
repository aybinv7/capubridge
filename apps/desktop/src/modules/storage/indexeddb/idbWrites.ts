import { toast } from "vue-sonner";
import type { IDBDomain } from "@capubridge/cdp-protocol";
import type { IDBRecord } from "@/types/storage.types";

export interface IdbStoreAddress {
  origin: string;
  database: string;
  store: string;
}

type EditableRecord = IDBRecord & {
  primaryKey?: IDBValidKey;
  editable?: boolean;
  readOnlyReason?: string;
};

export interface IdbWriteHooks {
  /** Called with the keys the device accepted, before the success toast. */
  onWritten?: (keys: readonly IDBValidKey[]) => void;
}

/**
 * Device writes for one object store. Every outcome is reported only after the
 * device answered, so the UI never claims a write that did not happen.
 */
export function idbWrites(domain: IDBDomain, at: IdbStoreAddress, hooks: IdbWriteHooks = {}) {
  async function save(record: IDBRecord): Promise<boolean> {
    const candidate = record as EditableRecord;
    if (candidate.editable === false) {
      toast.error("Record is read-only", {
        description: candidate.readOnlyReason ?? "Unsupported value",
      });
      return false;
    }
    const key = candidate.primaryKey ?? record.key;
    try {
      await domain.putRecord(at.origin, at.database, at.store, record.value, key);
      hooks.onWritten?.([key]);
      toast.success("Record saved on the device");
      return true;
    } catch (error) {
      toast.error("Record was not saved", { description: String(error) });
      return false;
    }
  }

  /** Changes one field on the device; the rest of the record is kept exactly as stored. */
  async function patch(
    key: IDBValidKey,
    path: readonly string[],
    value: unknown,
  ): Promise<boolean> {
    try {
      await domain.patchRecord(at.origin, at.database, at.store, key, path, value);
      hooks.onWritten?.([key]);
      toast.success("Record saved on the device");
      return true;
    } catch (error) {
      toast.error("Record was not saved", { description: String(error) });
      return false;
    }
  }

  async function remove(keys: readonly IDBValidKey[]): Promise<number> {
    const failures: string[] = [];
    const removed: IDBValidKey[] = [];
    for (const key of keys) {
      try {
        await domain.deleteRecord(at.origin, at.database, at.store, key);
        removed.push(key);
      } catch (error) {
        failures.push(String(error));
      }
    }
    if (removed.length > 0) hooks.onWritten?.(removed);
    const deleted = removed.length;
    if (failures.length === 0) {
      toast.success(
        deleted === 1 ? "Record deleted on the device" : `${deleted} records deleted on the device`,
      );
    } else {
      toast.error(
        keys.length === 1
          ? "Record was not deleted"
          : `${failures.length} of ${keys.length} deletes failed`,
        { description: failures[0] },
      );
    }
    return deleted;
  }

  return { save, patch, remove };
}
