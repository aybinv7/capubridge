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
          path: "button",
          component: () => import("./modules/playground/sections/ButtonSection.vue"),
        },
        {
          path: "segmented",
          component: () => import("./modules/playground/sections/SegmentedSection.vue"),
        },
        {
          path: "toolbar",
          component: () => import("./modules/playground/sections/ToolbarSection.vue"),
        },
        {
          path: "toggle-group",
          component: () => import("./modules/playground/sections/ToggleGroupSection.vue"),
        },
        {
          path: "chip",
          component: () => import("./modules/playground/sections/ChipSection.vue"),
        },
        {
          path: "slider",
          component: () => import("./modules/playground/sections/SliderSection.vue"),
        },
        {
          path: "checkbox",
          component: () => import("./modules/playground/sections/CheckboxSection.vue"),
        },
        {
          path: "select",
          component: () => import("./modules/playground/sections/SelectSection.vue"),
        },
        {
          path: "dialog",
          component: () => import("./modules/playground/sections/DialogSection.vue"),
        },
        {
          path: "popover",
          component: () => import("./modules/playground/sections/PopoverSection.vue"),
        },
        {
          path: "tooltip",
          component: () => import("./modules/playground/sections/TooltipSection.vue"),
        },
        {
          path: "spinner",
          component: () => import("./modules/playground/sections/SpinnerSection.vue"),
        },
        {
          path: "tabs",
          component: () => import("./modules/playground/sections/TabsSection.vue"),
        },
        {
          path: "accordion",
          component: () => import("./modules/playground/sections/AccordionSection.vue"),
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
