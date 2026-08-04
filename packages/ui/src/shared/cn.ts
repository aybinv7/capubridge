import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge, validators } from "tailwind-merge";

const safeGroup = (prefix: string) => ({
  [prefix]: ["safe", { safe: [validators.isNumber] }],
});

const safeNumberGroup = (prefix: string) => ({
  [prefix]: [{ safe: [validators.isNumber] }],
});

const sizeScale = [
  "cui-3xs",
  "cui-2xs",
  "cui-xs",
  "cui-sm",
  "cui-md",
  "cui-lg",
  "cui-xl",
  "cui-2xl",
];

const nestedSizeScale = sizeScale.map((token) => token.replace("cui-", "cui-nested-"));

const thumbScale = ["cui-thumb-xs", "cui-thumb-sm", "cui-thumb-md"];

const radiusLadder = ["cui", ...sizeScale];

const radiusVariant = (infix: string) =>
  ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"].map((token) => `cui-${infix}${token}`);

const overlayRadii = ["cui-popover", "cui-dialog", "cui-toast", "cui-popup", "cui-tooltip"];

const uiTailwindMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      pl: [safeGroup("pl")],
      pr: [safeGroup("pr")],
      pt: [safeGroup("pt")],
      pb: [safeGroup("pb")],
      px: [safeNumberGroup("px")],
      py: [safeNumberGroup("py")],

      ml: [safeGroup("ml")],
      mr: [safeGroup("mr")],
      mt: [safeGroup("mt")],
      mb: [safeGroup("mb")],
      mx: [safeNumberGroup("mx")],
      my: [safeNumberGroup("my")],

      "scroll-ml": [safeNumberGroup("scroll-ml")],
      "scroll-mr": [safeNumberGroup("scroll-mr")],
      "scroll-mt": [safeNumberGroup("scroll-mt")],
      "scroll-mb": [safeNumberGroup("scroll-mb")],

      left: [safeGroup("left")],
      right: [safeGroup("right")],
      top: [safeGroup("top")],
      bottom: [safeGroup("bottom")],
    },
    theme: {
      text: ["cui-4xs", "cui-3xs", "cui-2xs", "cui-xs", "cui-sm", "cui-md"],
      spacing: [...sizeScale, ...thumbScale, ...nestedSizeScale],
      radius: [
        ...radiusLadder,
        ...radiusVariant("full-"),
        ...radiusVariant("wrap-"),
        ...radiusVariant("wrap-full-"),
        ...radiusVariant("focus-"),
        ...radiusVariant("focus-full-"),
        ...overlayRadii,
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return uiTailwindMerge(clsx(inputs));
}
