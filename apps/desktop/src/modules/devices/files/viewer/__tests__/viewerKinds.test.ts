import { describe, expect, test } from "vite-plus/test";
import {
  extensionOf,
  kindFromName,
  kindWord,
  languageFromName,
  mimeFromName,
} from "../viewerKinds";

describe("viewerKinds", () => {
  test("reads the extension, ignoring dot files and trailing dots", () => {
    expect(extensionOf("Photo.JPG")).toBe("jpg");
    expect(extensionOf(".bashrc")).toBe("");
    expect(extensionOf("README")).toBe("");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf("odd.")).toBe("");
  });

  test("guesses the kind from the name", () => {
    expect(kindFromName("a.png")).toBe("image");
    expect(kindFromName("a.webm")).toBe("video");
    expect(kindFromName("a.m4a")).toBe("audio");
    expect(kindFromName("a.har")).toBe("json");
    expect(kindFromName("a.ts")).toBe("text");
    expect(kindFromName("a.log")).toBe("text");
    expect(kindFromName("app.sqlite3")).toBe("sqlite");
    expect(kindFromName("base.apk")).toBe("binary");
    expect(kindFromName("report.pdf")).toBe("binary");
    expect(kindFromName("prefs")).toBe("unknown");
    expect(kindFromName("data.xyz")).toBe("unknown");
  });

  test("picks a grammar per extension and keeps logs hand-coloured", () => {
    expect(languageFromName("a.json")).toBe("json");
    expect(languageFromName("a.mjs")).toBe("javascript");
    expect(languageFromName("a.tsx")).toBe("tsx");
    expect(languageFromName("AndroidManifest.xml")).toBe("xml");
    expect(languageFromName("index.htm")).toBe("html");
    expect(languageFromName("schema.sql")).toBe("sql");
    expect(languageFromName("logcat.log")).toBe("log");
    expect(languageFromName("notes")).toBe("plain");
  });

  test("labels blobs so SVG and media decode", () => {
    expect(mimeFromName("icon.svg")).toBe("image/svg+xml");
    expect(mimeFromName("clip.mov")).toBe("video/quicktime");
    expect(mimeFromName("unknown.bin")).toBe("");
  });

  test("names kinds in plain words", () => {
    expect(kindWord("json")).toBe("JSON");
    expect(kindWord("text", "typescript")).toBe("TypeScript");
    expect(kindWord("text", "plain")).toBe("Text");
    expect(kindWord("sqlite")).toBe("SQLite database");
  });
});
