import { describe, expect, test } from "vite-plus/test";
import { targetAppName } from "../target-app-name";

describe("targetAppName", () => {
  test("prefers the installed label, then the page title, then the address", () => {
    const target = { title: " Presalio ", url: "https://localhost/" };
    expect(targetAppName(target, "Presalio Retail")).toBe("Presalio Retail");
    expect(targetAppName(target, "  ")).toBe("Presalio");
    expect(targetAppName({ title: "", url: "https://localhost/" }, null)).toBe(
      "https://localhost/",
    );
    expect(targetAppName(null, "Presalio Retail")).toBeNull();
  });
});
