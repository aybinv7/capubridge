import { describe, expect, test } from "vite-plus/test";
import { batteryTone, loadTone, memoryTone } from "../tones";

describe("reading tones", () => {
  test("load is plain until it is high, battery until it is low", () => {
    expect(loadTone(null)).toBe("text-muted-foreground");
    expect(loadTone(42)).toBe("text-foreground");
    expect(loadTone(65)).toBe("text-warning");
    expect(loadTone(91)).toBe("text-error");
    expect(memoryTone(62)).toBe("text-foreground");
    expect(memoryTone(90)).toBe("text-warning");
    expect(batteryTone(15)).toBe("text-error");
    expect(batteryTone(35)).toBe("text-warning");
    expect(batteryTone(90)).toBe("text-foreground");
  });
});
