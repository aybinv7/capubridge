import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  // Build-tool artifacts (Vercel's generated .vercel/ manifest, build output)
  // must not be scanned by `vp check` — they break the deploy build otherwise.
  fmt: { ignorePatterns: ["**/.vercel/**", "**/dist/**", "packages/cladd/**"] },
  lint: {
    ignorePatterns: ["**/.vercel/**", "**/dist/**"],
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
    tasks: {
      "reference:cladd": {
        command: "node scripts/reference-cladd.mjs",
      },
      "check:versions": {
        command: "node scripts/check-versions.mjs",
        env: ["GITHUB_REF_TYPE", "GITHUB_REF_NAME"],
      },
      "sync:cladd": {
        command: "node scripts/sync-cladd.mjs",
        cache: false,
      },
      "check:modules": {
        command: "node scripts/check-module-boundaries.mjs",
      },
      "check:ipc-boundary": {
        command: "node scripts/check-direct-ipc.mjs",
      },
      "check:silent-errors": {
        command: "node scripts/check-silent-errors.mjs",
      },
      "check:async-commands": {
        command: "node scripts/check-async-commands.mjs",
      },
      "check:design-tokens": {
        command: "node scripts/check-design-tokens.mjs",
      },
      "check:cladd-adoption": {
        command: "node scripts/check-cladd-adoption.mjs",
      },
      "check:vue-types": {
        command: "node scripts/check-vue-types.mjs",
      },
      "check:source-size": {
        command: "node scripts/check-source-size.mjs",
      },
      "test:rust": {
        command: "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml",
        env: ["CARGO_TARGET_DIR"],
      },
      "test:all": {
        command:
          "vp run -r --concurrency-limit 1 test -- --run && vp test run scripts && vp run test:rust",
      },
      ready: {
        command:
          "vp check && vp run check:versions && vp run check:modules && vp run check:ipc-boundary && vp run check:silent-errors && vp run check:async-commands && vp run check:design-tokens && vp run check:cladd-adoption && vp run check:vue-types && vp run check:source-size && vp run desktop#check:contrast && vp run test:all && vp run -r build",
      },
    },
  },
});
