import { describe, expect, test } from "vite-plus/test";
import type { LocalPageVisit } from "@/lib/local-page-history";
import { tabLabel } from "../local-tab-label";

const visit = (url: string, title: string, icon: string | null = null): LocalPageVisit =>
  ({ url, title, icon, openedAt: 0 }) as LocalPageVisit;

describe("tabLabel", () => {
  test("the live title wins, with the live address", () => {
    const label = tabLabel(
      { url: "http://localhost:5181/panels" },
      {
        url: "http://localhost:5181/panels/planograms/10",
        title: "Planogram 10",
        icon: "data:image/png;base64,x",
      },
      [visit("http://localhost:5181/panels", "Presalio · Panneaux")],
    );
    expect(label).toEqual({
      title: "Planogram 10",
      url: "http://localhost:5181/panels/planograms/10",
      icon: "data:image/png;base64,x",
    });
  });

  test("before the page reports, the title it had when last open", () => {
    const label = tabLabel({ url: "http://localhost:5181/panels" }, undefined, [
      visit("http://localhost:5181/panels", "Presalio · Panneaux", "data:image/png;base64,y"),
    ]);
    expect(label.title).toBe("Presalio · Panneaux");
    expect(label.icon).toBe("data:image/png;base64,y");
  });

  test("with nothing known, the host", () => {
    expect(tabLabel({ url: "http://localhost:5173/x" }, undefined, []).title).toBe(
      "localhost:5173",
    );
  });

  test("a blank live title falls back instead of showing nothing", () => {
    const label = tabLabel(
      { url: "http://localhost:5173/" },
      { url: "http://localhost:5173/", title: "   ", icon: null },
      [],
    );
    expect(label.title).toBe("localhost:5173");
  });
});
