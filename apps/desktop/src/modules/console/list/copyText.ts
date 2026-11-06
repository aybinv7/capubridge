import { toast } from "@/lib/toast";

/** Copies `text` and says so; a failure is shown, never swallowed. */
export async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${what}`);
  } catch (error) {
    toast.error(`Could not copy ${what}`, { description: String(error) });
  }
}
