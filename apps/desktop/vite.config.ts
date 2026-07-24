import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
// import vueDevTools from "vite-plugin-vue-devtools";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    watch: {
      // Never watch the Rust build output. Chokidar recursively walks the
      // project, and watching src-tauri/target/**/app.exe races with `cargo`
      // rewriting it during `tauri dev`, throwing EBUSY and killing the dev
      // server. Vite has no reason to watch compiled Rust artifacts anyway.
      ignored: ["**/pnpm-workspace.yaml", "**/pnpm-lock.yaml", "**/src-tauri/target/**"],
    },
  },
});
