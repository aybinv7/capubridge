/** What a view can ask of its `StreamList`. */
export interface StreamListHandle {
  scrollToKey(key: string): void;
  focus(): void;
  clearSelection(): boolean;
}
