import { describe, expect, test } from "vite-plus/test";
import { displayAddress, resolveAddress } from "../local-address";

const current = "http://localhost:5181/panels/planograms?tab=2";

describe("resolveAddress", () => {
  test("a path stays on the same page", () => {
    expect(resolveAddress("/panels/shelves", current)).toEqual({
      kind: "same-page",
      url: "http://localhost:5181/panels/shelves",
    });
  });

  test("a query or a hash keeps the current path", () => {
    expect(resolveAddress("?tab=3", current)?.url).toBe(
      "http://localhost:5181/panels/planograms?tab=3",
    );
    expect(resolveAddress("#top", current)?.url).toBe(
      "http://localhost:5181/panels/planograms?tab=2#top",
    );
  });

  test("a bare path without a slash is a path on the same origin", () => {
    expect(resolveAddress("panels/shelves", current)).toEqual({
      kind: "same-page",
      url: "http://localhost:5181/panels/shelves",
    });
  });

  test("a full URL on the same origin stays on the same page", () => {
    expect(resolveAddress("localhost:5181/panels", current)).toEqual({
      kind: "same-page",
      url: "http://localhost:5181/panels",
    });
  });

  test("another port, host or scheme is another page", () => {
    expect(resolveAddress("localhost:5173", current)).toEqual({
      kind: "other-page",
      url: "http://localhost:5173/",
    });
    expect(resolveAddress("https://localhost:5181/panels", current)?.kind).toBe("other-page");
    expect(resolveAddress("app.example.com/login", current)).toEqual({
      kind: "other-page",
      url: "https://app.example.com/login",
    });
  });

  test("nothing, or words, lead nowhere", () => {
    expect(resolveAddress("   ", current)).toBeNull();
    expect(resolveAddress("two words", current)).toBeNull();
  });

  test("without a current page, only a full URL works", () => {
    expect(resolveAddress("/panels", "")).toBeNull();
    expect(resolveAddress("localhost:5181", "")?.kind).toBe("other-page");
  });
});

describe("displayAddress", () => {
  test("drops the scheme and splits the origin from the rest", () => {
    expect(displayAddress(current)).toEqual({
      origin: "localhost:5181",
      rest: "/panels/planograms?tab=2",
    });
  });

  test("a bare origin shows no trailing slash", () => {
    expect(displayAddress("http://localhost:5173/")).toEqual({
      origin: "localhost:5173",
      rest: "",
    });
  });
});
