export interface BoxModelDimensions {
  width: number;
  height: number;
}

export interface StyleDeclarationEntry {
  name: string;
  value: string;
}

export type BoxModelRegion = "margin" | "border" | "padding" | "content" | null;
