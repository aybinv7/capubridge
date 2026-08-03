import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: ["@capubridge/ui", "shiki"],
  },
  resolve: {
    conditions: ["source", "module", "browser", "development|production"],
  },
});
