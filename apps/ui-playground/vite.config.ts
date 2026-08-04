import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  optimizeDeps: {
    exclude: ["@capubridge/ui", "shiki"],
  },
  resolve: {
    conditions: ["source", "module", "browser", "development|production"],
  },
});
