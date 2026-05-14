export type BrowserPreviewPortPreset = {
  port: number;
  label: string;
  hint: string;
};

export const BROWSER_PREVIEW_PORT_PRESETS: readonly BrowserPreviewPortPreset[] = [
  { port: 5173, label: "Vite", hint: "vite" },
  { port: 5174, label: "Vite alt", hint: "second vite" },
  { port: 3000, label: "Next", hint: "next, node" },
  { port: 3001, label: "Next alt", hint: "second next" },
  { port: 4173, label: "Vite preview", hint: "preview" },
  { port: 4200, label: "Angular", hint: "angular" },
  { port: 4321, label: "Astro", hint: "astro" },
  { port: 5500, label: "Live Server", hint: "vscode" },
  { port: 6006, label: "Storybook", hint: "storybook" },
  { port: 8080, label: "Webpack", hint: "webpack" },
  { port: 8081, label: "Metro", hint: "react native" },
  { port: 8000, label: "Django", hint: "django, fastapi" },
  { port: 5000, label: "Flask", hint: "flask" },
  { port: 7860, label: "Gradio", hint: "gradio" },
];
