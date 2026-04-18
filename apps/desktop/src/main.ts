import "@/assets/styles/main.css";
import "vue-sonner/style.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import router from "@/router";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);

app.config.errorHandler = (err, _instance, info) => {
  console.error("[vue:error]", info, err);
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandled-rejection]", event.reason);
  event.preventDefault();
});

app.mount("#app");
