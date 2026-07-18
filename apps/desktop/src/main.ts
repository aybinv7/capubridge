import "@/assets/styles/main.css";
import "vue-sonner/style.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import router from "@/router";
import { useSessionStore } from "@/stores/session.store";
import { useThemeStore } from "@/stores/theme.store";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(VueQueryPlugin);

// Apply the persisted theme + accent before mount to avoid a flash of the
// default palette.
const themeStore = useThemeStore(pinia);
themeStore.initialize();

const sessionStore = useSessionStore(pinia);
void sessionStore.initialize();

app.config.errorHandler = (err, _instance, info) => {
  console.error("[vue:error]", info, err);
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandled-rejection]", event.reason);
  event.preventDefault();
});

window.addEventListener("beforeunload", () => {
  void sessionStore.dispose();
});

app.mount("#app");
