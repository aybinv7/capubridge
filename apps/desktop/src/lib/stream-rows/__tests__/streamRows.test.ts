import { describe, expect, it } from "vite-plus/test";
import { foldStack, javaStackLines } from "@/lib/stream-rows/foldStack";
import { findJson } from "@/lib/stream-rows/jsonInText";

function shape(segments: ReturnType<typeof foldStack>): string[] {
  return segments.map((segment) =>
    segment.kind === "fold" ? `+${segment.count}` : segment.line.text.trim(),
  );
}

describe("foldStack", () => {
  const crash = [
    "java.lang.IllegalStateException: boom",
    "\tat android.os.Handler.dispatch(Handler.java:1)",
    "\tat com.shop.app.Cart.add(Cart.java:12)",
    "\tat com.shop.app.Main.run(Main.java:3)",
    "\tat android.os.Looper.loop(Looper.java:9)",
    "\tat java.lang.Thread.run(Thread.java:1)",
    "Caused by: java.io.IOException: offline",
    "\tat okhttp3.Call.execute(Call.java:5)",
    "\t... 4 more",
  ].join("\n");

  it("keeps frames up to the end of the first app run and folds the rest", () => {
    const lines = javaStackLines(crash, "com.shop.app");
    expect(lines.filter((line) => line.app)).toHaveLength(2);
    expect(shape(foldStack(lines))).toEqual([
      "java.lang.IllegalStateException: boom",
      "at android.os.Handler.dispatch(Handler.java:1)",
      "at com.shop.app.Cart.add(Cart.java:12)",
      "at com.shop.app.Main.run(Main.java:3)",
      "+2",
      "Caused by: java.io.IOException: offline",
      "at okhttp3.Call.execute(Call.java:5)",
      "... 4 more",
    ]);
  });

  it("shows three frames of a section without app frames", () => {
    const lines = javaStackLines(crash, null);
    expect(shape(foldStack(lines)).slice(0, 5)).toEqual([
      "java.lang.IllegalStateException: boom",
      "at android.os.Handler.dispatch(Handler.java:1)",
      "at com.shop.app.Cart.add(Cart.java:12)",
      "at com.shop.app.Main.run(Main.java:3)",
      "+2",
    ]);
  });
});

describe("findJson", () => {
  it("finds an object inside a message and pretty-prints it", () => {
    const found = findJson('sync done payload={"ok":true,"items":[1,2]} in 20 ms');
    expect(found?.before).toBe("sync done payload=");
    expect(found?.value).toEqual({ ok: true, items: [1, 2] });
    expect(found?.after).toBe(" in 20 ms");
    expect(found?.pretty).toContain('\n  "ok": true');
  });

  it("skips brackets that are not JSON and handles braces in strings", () => {
    expect(findJson('[main] state {x} then {"a":"}{"}')?.value).toEqual({ a: "}{" });
    expect(findJson("no json [here]")).toBeNull();
    expect(findJson("[1, 2]")?.value).toEqual([1, 2]);
  });
});
