import { describe, expect, test, vi } from "vite-plus/test";
import { nextTick, ref } from "vue";
import { useWhenRead } from "../useWhenRead";

describe("an action asked for before the list was read (B1)", () => {
  test("runs once the read settles", async () => {
    const pending = ref(true);
    const error = ref<unknown>(null);
    const task = vi.fn();
    const when = useWhenRead(pending, error, vi.fn());
    when.run(task);
    expect(task).not.toHaveBeenCalled();
    pending.value = false;
    await nextTick();
    expect(task).toHaveBeenCalledTimes(1);
    pending.value = true;
    pending.value = false;
    await nextTick();
    expect(task).toHaveBeenCalledTimes(1);
  });

  test("runs at once when the list is already read", () => {
    const task = vi.fn();
    useWhenRead(ref(false), ref(null), vi.fn()).run(task);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test("never runs when the read fails, and says so", async () => {
    const pending = ref(true);
    const error = ref<unknown>(null);
    const task = vi.fn();
    const failed = vi.fn();
    useWhenRead(pending, error, failed).run(task);
    error.value = new Error("gone");
    await nextTick();
    expect(task).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
  });
});
