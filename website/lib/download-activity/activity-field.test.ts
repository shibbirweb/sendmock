import { describe, expect, test } from "bun:test";

import {
  buildShadeColors,
  findShadeIndex,
  parseHexColor,
} from "./activity-colors";
import {
  breatheLevel,
  emptyDayGlow,
  listActivityCells,
  listCellNeighbours,
  measureActivityGrid,
} from "./activity-field";
import { easeToward } from "./ease-toward";
import { mapDaysToCells } from "./map-days-to-cells";

describe("the squares inside the letters", () => {
  test("WS-15.1 keeps only the squares whose centre is inside the letters", () => {
    const insideLeftHalf = (x: number) => x < 5;

    const cells = listActivityCells(10, 4, insideLeftHalf, 2);

    expect(measureActivityGrid(10, 4, 2)).toEqual({
      columns: 5,
      rows: 2,
      offsetX: 0,
      offsetY: 0,
    });
    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ]);
  });

  test("WS-15.1 finds each square's neighbours by grid position", () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 8, y: 8 },
    ];

    expect(listCellNeighbours(cells, 2)).toEqual([[1], [0], []]);
  });

  test("WS-15.1 spreads the days left to right, oldest day in the first letter", () => {
    const cells = Array.from({ length: 70 }, (_, column) => ({
      x: column * 2,
      y: 0,
    }));

    const cellLevels = mapDaysToCells(cells, [4, 0, 0, 0, 0, 0, 0]);

    expect(cellLevels[0]).toBeGreaterThan(2.5);
    expect(cellLevels.at(-1)).toBe(0);
  });
});

describe("breathing", () => {
  test("WS-15.4 a lit square breathes around its level and an empty day only glows faintly", () => {
    expect(breatheLevel(2, 1, 1)).toBeCloseTo(2.4);
    expect(breatheLevel(2, 1, 0)).toBe(2);
    expect(breatheLevel(0, 1, 1)).toBeCloseTo(emptyDayGlow);
    expect(breatheLevel(4, 1, 1)).toBe(4);
  });
});

describe("colours", () => {
  test("WS-15.6 mixes the theme's level colours into in-between shades", () => {
    const shadeColors = buildShadeColors(["#000000", "#ffffff"]);

    expect(parseHexColor("#0f0")).toEqual([0, 255, 0]);
    expect(parseHexColor("var(--brand-from)")).toBeNull();
    expect(shadeColors[0]).toBe("#000000");
    expect(shadeColors[4]).toBe("rgb(128 128 128)");
    expect(shadeColors.at(-1)).toBe("#ffffff");
    expect(findShadeIndex(0.5)).toBe(4);
  });
});

describe("easing", () => {
  test("WS-15.5 eases toward the target and jumps with no easing time", () => {
    expect(easeToward(0, 100, 100, 100)).toBeCloseTo(63.2, 1);
    expect(easeToward(0, 100, 16, 0)).toBe(100);
  });
});
