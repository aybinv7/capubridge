import { beforeEach, describe, expect, test } from "vite-plus/test";
import { dismiss, forgetToast, toast, toastEntries } from "@/lib/toast";

describe("the app's toasts", () => {
  beforeEach(() => {
    toastEntries.value = [];
  });

  test("each kind gets its colour and a timeout; loading stays until replaced", () => {
    toast.success("Saved");
    toast.error("Failed", { description: "The device refused" });
    toast.loading("Copying");
    const [saved, failed, loading] = toastEntries.value;
    expect(saved).toMatchObject({ title: "Saved", color: "green", open: true });
    expect(failed).toMatchObject({ color: "red", text: "The device refused" });
    expect(failed?.timeout).toBeGreaterThan(saved?.timeout ?? 0);
    expect(loading?.timeout).toBe(0);
  });

  test("the same id replaces a toast instead of stacking a second one", () => {
    const id = toast.loading("Exporting");
    toast.success("Exported", { id });
    const open = toastEntries.value.filter((entry) => entry.open);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ id, title: "Exported", color: "green" });
  });

  test("dismiss closes, and a finished close removes the entry", () => {
    const id = toast.info("Hello");
    dismiss(id);
    expect(toastEntries.value[0]?.open).toBe(false);
    forgetToast(toastEntries.value[0]?.key ?? "");
    expect(toastEntries.value).toHaveLength(0);
  });

  test("a promise turns its loading toast into the outcome", async () => {
    const id = toast.promise(Promise.resolve(3), {
      loading: "Reading",
      success: (value) => `Read ${value}`,
      error: "Failed",
    });
    await Promise.resolve();
    await Promise.resolve();
    const open = toastEntries.value.filter((entry) => entry.open && entry.id === id);
    expect(open[0]?.title).toBe("Read 3");
  });
});
