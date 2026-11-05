import { describe, expect, it } from "vite-plus/test";
import {
  MAX_ICON_DATA_URL_LENGTH,
  MAX_LOCAL_PAGE_VISITS,
  describeVisit,
  iconForUrl,
  recordVisit,
  type LocalPageVisit,
} from "../local-page-history";

const icon = "data:image/png;base64,AAAA";

describe("local page history", () => {
  it("puts the latest visit first without duplicates, up to the limit", () => {
    let visits: LocalPageVisit[] = [];
    for (let index = 0; index < MAX_LOCAL_PAGE_VISITS + 3; index += 1) {
      visits = recordVisit(visits, `http://localhost:${3000 + index}/`, index);
    }
    visits = recordVisit(visits, "http://localhost:3005/", 99);
    expect(visits).toHaveLength(MAX_LOCAL_PAGE_VISITS);
    expect(visits[0]).toMatchObject({ url: "http://localhost:3005/", openedAt: 99 });
    expect(visits.filter((visit) => visit.url === "http://localhost:3005/")).toHaveLength(1);
  });

  it("keeps the title and icon a page reported, and lends the icon to its site", () => {
    let visits = recordVisit([], "http://localhost:3000/", 1);
    visits = describeVisit(visits, "http://localhost:3000/", { title: " Shop ", icon });
    expect(visits[0]).toMatchObject({ title: "Shop", icon });
    visits = recordVisit(visits, "http://localhost:3000/cart", 2);
    expect(visits[0].icon).toBe(icon);
    expect(iconForUrl(visits, "http://localhost:3000/checkout")).toBe(icon);
    expect(iconForUrl(visits, "http://localhost:4000/")).toBeNull();
  });

  it("drops an icon too large to store", () => {
    const visits = describeVisit(recordVisit([], "http://a.test/", 1), "http://a.test/", {
      title: "A",
      icon: `data:image/png;base64,${"A".repeat(MAX_ICON_DATA_URL_LENGTH)}`,
    });
    expect(visits[0].icon).toBeNull();
  });
});
