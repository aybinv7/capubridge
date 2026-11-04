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

/**
 * Device writes for one object store. Every outcome is reported only after the
 * device answered, so the UI never claims a write that did not happen.
 */
export function idbWrites(domain: IDBDomain, at: IdbStoreAddress) {
  async function save(record: IDBRecord): Promise<boolean> {
    const candidate = record as EditableRecord;
    if (candidate.editable === false) {
      toast.error("Record is read-only", {
        description: candidate.readOnlyReason ?? "Unsupported value",
      });
      return false;
    }
    try {
      await domain.putRecord(
        at.origin,
        at.database,
        at.store,
        record.value,
        candidate.primaryKey ?? record.key,
      );
      toast.success("Record saved on the device");
      return true;
    } catch (error) {
      toast.error("Record was not saved", { description: String(error) });
      return false;
    }
  }

  async function remove(keys: readonly IDBValidKey[]): Promise<number> {
    const failures: string[] = [];
    for (const key of keys) {
      try {
        await domain.deleteRecord(at.origin, at.database, at.store, key);
      } catch (error) {
        failures.push(String(error));
      }
    }
    const deleted = keys.length - failures.length;
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

  return { save, remove };
}
