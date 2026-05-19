import "@/assets/styles/main.css";
import "vue-sonner/style.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import router from "@/router";
import { useSessionStore } from "@/stores/session.store";
import { useThemeStore } from "@/stores/theme.store";
import { useTabsStore } from "@/stores/tabs.store";
import { useTabStateStore } from "@/stores/tabState.store";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(VueQueryPlugin);

const themeStore = useThemeStore(pinia);
themeStore.initialize();

const tabStateStore = useTabStateStore(pinia);
tabStateStore.initialize();

const tabsStore = useTabsStore(pinia);
tabsStore.initialize();
tabStateStore.pruneTo(tabsStore.tabs.map((t) => t.id));

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
