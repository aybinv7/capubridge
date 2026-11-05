import type { NetworkTypeFilter } from "@/types/network.types";
import { formatBytes } from "./requestCells";

export const TYPE_FILTERS: ReadonlyArray<{
  value: NetworkTypeFilter;
  label: string;
  hint: string;
}> = [
  { value: "All", label: "All", hint: "Every request" },
  {
    value: "XHR/Fetch",
    label: "Fetch/XHR",
    hint: "Calls made from code with fetch or XMLHttpRequest",
  },
  { value: "WS", label: "WebSocket", hint: "WebSocket connections" },
  { value: "Doc", label: "Document", hint: "Pages and frames" },
  { value: "Img", label: "Image", hint: "Pictures and icons" },
  { value: "Media", label: "Media", hint: "Audio and video" },
  { value: "Font", label: "Font", hint: "Web fonts" },
  { value: "Script", label: "Script", hint: "JavaScript files" },
  {
    value: "Preflight",
    label: "Preflight",
    hint: "CORS checks the browser sends before a request",
  },
  {
    value: "Other",
    label: "Other",
    hint: "Styles, manifests, pings, event streams and the rest",
  },
];

export const METHOD_OPTIONS = [
  { value: "All", label: "Any method" },
  ...["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].map((method) => ({
    value: method,
    label: method,
  })),
];

export const SCOPE_OPTIONS = [
  { value: "url", label: "In addresses" },
  { value: "all", label: "Also in headers and bodies" },
];

export interface SummaryInput {
  total: number;
  shown: number;
  transferred: number;
  resources: number;
  filtering: boolean;
}

/**
 * The line beside the filters, like DevTools: how many requests, what crossed the network, how
 * large the bodies are (app files count only there), and how many the filters show.
 */
export function requestsSummary(input: SummaryInput): string {
  const parts = [`${input.total} ${input.total === 1 ? "request" : "requests"}`];
  parts.push(`${formatBytes(input.transferred)} transferred`);
  if (input.resources > 0) parts.push(`${formatBytes(input.resources)} resources`);
  if (input.filtering) parts.push(`${input.shown} shown`);
  return parts.join(" · ");
}
