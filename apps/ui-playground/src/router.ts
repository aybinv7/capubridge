import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/components/surfaces",
    },
    {
      path: "/components",
      component: () => import("./modules/playground/PlaygroundView.vue"),
      children: [
        {
          path: "surfaces",
          component: () => import("./modules/playground/sections/SurfacesSection.vue"),
        },
        {
          path: "buttons",
          component: () => import("./modules/playground/sections/ButtonsSection.vue"),
        },
        {
          path: "data-display",
          component: () => import("./modules/playground/sections/DataDisplaySection.vue"),
        },
        {
          path: "forms",
          component: () => import("./modules/playground/sections/FormsSection.vue"),
        },
        {
          path: "select",
          component: () => import("./modules/playground/sections/SelectSection.vue"),
        },
        {
          path: "overlays",
          component: () => import("./modules/playground/sections/OverlaysSection.vue"),
        },
        {
          path: "feedback",
          component: () => import("./modules/playground/sections/FeedbackSection.vue"),
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/components/surfaces",
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
