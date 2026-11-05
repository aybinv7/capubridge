import type { AdbPackage } from "@/types/adb.types";

/** A value the phone reported, or `null` when it sent nothing or the word "null". */
export function knownValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "null" ? trimmed : null;
}

/** The name a person knows the app by, or its package when it has no label. */
export function appDisplayName(app: Pick<AdbPackage, "label" | "packageName">): string {
  const label = app.label?.trim();
  return label ? label : app.packageName;
}
