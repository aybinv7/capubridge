import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  run: {
    cache: true,
    tasks: {
      "check:versions": {
        command: "node scripts/check-versions.mjs",
        env: ["GITHUB_REF_TYPE", "GITHUB_REF_NAME"],
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
      "check:source-size": {
        command: "node scripts/check-source-size.mjs",
      },
      "test:rust": {
        command: "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml",
      },
      "test:all": {
        command: "vp run -r test && vp run test:rust",
      },
      ready: {
        command:
          "vp check && vp run check:versions && vp run check:modules && vp run check:ipc-boundary && vp run check:silent-errors && vp run check:source-size && vp run desktop#check:contrast && vp run test:all && vp run -r build",
      },
    },
  },
});
