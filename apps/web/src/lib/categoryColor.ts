import { prefersDarkTheme } from "./colorScheme";

// Validated 8-hue categorical palette (see the dataviz color-formula method).
const CATEGORICAL_LIGHT = [
  "#2a78d6",
  "#008300",
  "#e87ba4",
  "#eda100",
  "#1baf7a",
  "#eb6834",
  "#4a3aa7",
  "#e34948",
];

const CATEGORICAL_DARK = [
  "#3987e5",
  "#008300",
  "#d55181",
  "#c98500",
  "#199e70",
  "#d95926",
  "#9085e9",
  "#e66767",
];

// Entity.type and Relationship.type are open-ended free strings, not a fixed
// enum, so there's no way to know the full set of categories up front —
// colors are assigned from the palette in first-seen order, cycling past 8.
export function buildCategoryColorMap(keys: string[]): Map<string, string> {
  const palette = prefersDarkTheme() ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const map = new Map<string, string>();
  for (const key of keys) {
    if (!map.has(key)) {
      map.set(key, palette[map.size % palette.length]);
    }
  }
  return map;
}
