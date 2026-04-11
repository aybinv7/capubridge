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
      ignored: ["**/pnpm-workspace.yaml", "**/pnpm-lock.yaml"],
    },
  },
});
