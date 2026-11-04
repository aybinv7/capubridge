import { describe, expect, test } from "vite-plus/test";
import { compareWithBaseline, countRetiringImports } from "./check-cladd-adoption.mjs";

describe("countRetiringImports", () => {
  test("counts shadcn components that have a Cladd equivalent", () => {
    const source = [
      'import { Button } from "@/components/ui/button";',
      'import { Badge } from "@/components/ui/badge";',
      'import ButtonExtra from "@/components/ui/button/Button.vue";',
    ].join("\n");
    expect(countRetiringImports(source)).toEqual({ button: 2, badge: 1 });
  });

  test("ignores components Cladd does not replace yet", () => {
    const source = [
      'import { ScrollArea } from "@/components/ui/scroll-area";',
      'import { DropdownMenu } from "@/components/ui/dropdown-menu";',
      'import { Button } from "@capubridge/cladd";',
    ].join("\n");
    expect(countRetiringImports(source)).toEqual({});
  });
});

describe("compareWithBaseline", () => {
  test("flags growth in an existing file and any usage in a new file", () => {
    const { grown, shrunk } = compareWithBaseline(
      { "a.vue": { button: 2 }, "b.vue": { input: 1 } },
      { "a.vue": { button: 1 } },
    );
    expect(grown).toEqual([
      { file: "a.vue", component: "button", current: 2, limit: 1 },
      { file: "b.vue", component: "input", current: 1, limit: 0 },
    ]);
    expect(shrunk).toEqual([]);
  });

  test("reports shrinkage so the ratchet is tightened", () => {
    const { grown, shrunk } = compareWithBaseline({}, { "a.vue": { tooltip: 1 } });
    expect(grown).toEqual([]);
    expect(shrunk).toEqual([{ file: "a.vue", component: "tooltip", current: 0, limit: 1 }]);
  });

  test("passes when usage matches the baseline", () => {
    expect(compareWithBaseline({ "a.vue": { select: 1 } }, { "a.vue": { select: 1 } })).toEqual({
      grown: [],
      shrunk: [],
    });
  });
});
