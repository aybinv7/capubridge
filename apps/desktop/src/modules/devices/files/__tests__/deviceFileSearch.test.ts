import { describe, expect, test } from "vite-plus/test";
import { deviceSearchCommand, parseDeviceSearch } from "../deviceFileSearch";

function previousCommand(escaped: string, limit: number): string {
  return (
    `{ ` +
    `find /sdcard/Android/data -iname '*${escaped}*' 2>/dev/null; ` +
    `find /storage/emulated/0/Android/data -iname '*${escaped}*' 2>/dev/null; ` +
    `find /sdcard -maxdepth 8 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /storage/emulated/0 -maxdepth 8 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /data/local/tmp -iname '*${escaped}*' 2>/dev/null; ` +
    `find /data/data -maxdepth 4 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /data/app -maxdepth 4 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /system -maxdepth 7 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /vendor -maxdepth 6 -iname '*${escaped}*' 2>/dev/null; ` +
    `} | awk '!seen[$0]++' | head -n ${limit} ` +
    `| while IFS= read -r p; do ` +
    `if [ -L "$p" ]; then t=symlink; ` +
    `elif [ -d "$p" ]; then t=dir; ` +
    `elif [ -f "$p" ]; then t=file; ` +
    `else t=other; fi; ` +
    `printf '%s\\t%s\\n' "$t" "$p"; done`
  );
}

describe("deviceFileSearch", () => {
  test("builds the same command the Files tab always ran", () => {
    expect(deviceSearchCommand("log", 180)).toBe(previousCommand("log", 180));
  });

  test("escapes glob characters and quotes", () => {
    expect(deviceSearchCommand("a*b'c")).toContain(`-iname '*a\\*b'\\''c*'`);
    expect(deviceSearchCommand("   ")).toBeNull();
  });

  test("parses typed lines, drops repeats and puts folders first", () => {
    const entries = parseDeviceSearch(
      "file\t/sdcard/b.log\ndir\t/sdcard/logs/\nfile\t/sdcard/b.log\nweird\t/x/a.log\n\n",
    );
    expect(entries.map((entry) => [entry.entryType, entry.path])).toEqual([
      ["dir", "/sdcard/logs"],
      ["other", "/x/a.log"],
      ["file", "/sdcard/b.log"],
    ]);
    expect(entries[0]?.name).toBe("logs");
  });
});
