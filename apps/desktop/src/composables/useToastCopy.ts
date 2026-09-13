import { nextTick, onBeforeUnmount, onMounted } from "vue";

const DECORATED_FLAG = "toastCopy";
const RESET_DELAY = 1200;

function toastText(toast: HTMLElement): string {
  const title = toast.querySelector("[data-title]")?.textContent?.trim() ?? "";
  const description = toast.querySelector("[data-description]")?.textContent?.trim() ?? "";
  const combined = [title, description].filter(Boolean).join("\n\n");
  return combined || (toast.textContent?.trim() ?? "");
}

function decorate(toast: HTMLElement): void {
  if (toast.dataset[DECORATED_FLAG] === "true") return;
  toast.dataset[DECORATED_FLAG] = "true";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cui-toast-copy";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy message");

  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  const flash = (label: string) => {
    button.textContent = label;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      button.textContent = "Copy";
    }, RESET_DELAY);
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    navigator.clipboard.writeText(toastText(toast)).then(
      () => flash("Copied"),
      () => flash("Failed"),
    );
  });

  toast.appendChild(button);
}

export function useToastCopy(): void {
  let observer: MutationObserver | undefined;

  onMounted(async () => {
    await nextTick();
    const container = document.querySelector<HTMLElement>("[data-sonner-toaster]");
    if (!container) return;

    container.querySelectorAll<HTMLElement>("[data-sonner-toast]").forEach(decorate);

    observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches("[data-sonner-toast]")) decorate(node);
          node.querySelectorAll<HTMLElement>("[data-sonner-toast]").forEach(decorate);
        }
      }
    });
    observer.observe(container, { childList: true, subtree: true });
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = undefined;
  });
}
