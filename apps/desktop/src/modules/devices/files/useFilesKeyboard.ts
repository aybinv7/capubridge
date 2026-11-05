import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";
import type { useFileBrowser } from "./useFileBrowser";

interface FilesKeyboardDeps {
  browser: ReturnType<typeof useFileBrowser>;
  open: (entry: DeviceFileListEntry) => void;
  showDetails: (entry: DeviceFileListEntry) => void;
  requestDelete: (entry: DeviceFileListEntry) => void;
  columns: () => number;
  reveal: (index: number) => void;
}

/**
 * Keys of the listing: arrows move (a row of tiles at a time in the icon view), ← and Backspace go
 * up a folder in the list, → opens a folder or shows details, Enter opens, Delete asks to delete.
 */
export function useFilesKeyboard(deps: FilesKeyboardDeps) {
  const { browser } = deps;

  function move(step: number) {
    deps.reveal(browser.moveSelection(step));
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    const grid = browser.view.value === "grid";
    const selected = browser.selected.value;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(grid ? deps.columns() : 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        move(grid ? -deps.columns() : -1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        if (grid) move(-1);
        else browser.openParent();
        return;
      case "ArrowRight":
        event.preventDefault();
        if (grid) move(1);
        else if (selected && isFolderEntry(selected)) browser.openFolder(selected.path);
        else if (selected) deps.showDetails(selected);
        return;
      case "Backspace":
        event.preventDefault();
        browser.openParent();
        return;
      case "Enter":
        if (!selected) return;
        event.preventDefault();
        deps.open(selected);
        return;
      case "Delete":
        if (!selected) return;
        event.preventDefault();
        deps.requestDelete(selected);
        return;
    }
  }

  return { onKeydown };
}
