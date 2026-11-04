import { describe, expect, test } from "vite-plus/test";
import { parseVueTscOutput } from "./check-vue-types.mjs";

describe("parseVueTscOutput", () => {
  test("counts errors per file and ignores continuation lines", () => {
    const output = [
      "src/a.vue(1,2): error TS2322: Type 'x' is not assignable to type 'y'.",
      "  Type 'null' is not assignable to type 'string'.",
      "src/a.vue(9,1): error TS6133: 'v' is declared but its value is never read.",
      "src/b/c.ts(3,4): error TS7006: Parameter 'p' implicitly has an 'any' type.",
      "Found 3 errors.",
    ].join("\n");
    const { usage, messages } = parseVueTscOutput(output);
    expect(usage).toEqual({
      "apps/desktop/src/a.vue": { errors: 2 },
      "apps/desktop/src/b/c.ts": { errors: 1 },
    });
    expect(messages[1]).toMatchObject({ line: 9, code: "TS6133" });
  });
});
