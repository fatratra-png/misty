import {
  CELL_DEG,
  cellCenter,
  cellOf,
  cellsAround,
  coverage,
  distanceMeters,
  mergeIntoRows,
  regionToBounds,
} from "./grid";

describe("cellOf", () => {
  it("arrondit vers le bas, y compris pour les coordonnées négatives", () => {
    expect(
      cellOf({ latitude: CELL_DEG * 2.5, longitude: CELL_DEG * 0.1 }),
    ).toEqual({ i: 2, j: 0 });
    expect(
      cellOf({ latitude: -CELL_DEG * 0.1, longitude: -CELL_DEG * 2.5 }),
    ).toEqual({ i: -1, j: -3 });
  });
});

describe("distanceMeters", () => {
  it("compte environ 111 km par degré de latitude", () => {
    const d = distanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    expect(d).toBeCloseTo(111_195, -2);
  });
});

describe("cellsAround", () => {
  it("révèle la cellule courante et ses voisines dans le rayon", () => {
    const point = { latitude: 48.8566, longitude: 2.3522 };
    const cells = cellsAround(point, 40);
    expect(cells).toContainEqual(cellOf(point));
    expect(cells.length).toBeGreaterThan(4);
    for (const cell of cells) {
      expect(distanceMeters(point, cellCenter(cell))).toBeLessThanOrEqual(40);
    }
  });
});

describe("mergeIntoRows", () => {
  it("fusionne les cellules qui se suivent sur une même ligne", () => {
    const rects = mergeIntoRows([
      { i: 0, j: 0 },
      { i: 0, j: 1 },
      { i: 0, j: 2 }, // un rectangle
      { i: 0, j: 5 }, // un autre
      { i: 1, j: 0 }, // une autre ligne
    ]);
    expect(rects).toHaveLength(3);
  });

  it("regroupe les cellules en blocs quand on dézoome", () => {
    expect(
      mergeIntoRows(
        [
          { i: 0, j: 0 },
          { i: 1, j: 1 },
        ],
        2,
      ),
    ).toHaveLength(1);
  });
});

describe("regionToBounds", () => {
  it("ne retourne jamais un rectangle inversé près des pôles", () => {
    const north = regionToBounds({
      latitude: 85.2,
      longitude: 10,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    expect(north.minLat).toBeLessThan(north.maxLat);
    expect(north.maxLat).toBe(85);

    const south = regionToBounds({
      latitude: -85.2,
      longitude: 10,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    expect(south.minLat).toBeLessThan(south.maxLat);
    expect(south.minLat).toBe(-85);
  });
});

describe("coverage", () => {
  it("ne compte pas la cellule qui commence sur le bord du rectangle", () => {
    const bounds = {
      minLat: 0,
      maxLat: CELL_DEG,
      minLng: 0,
      maxLng: CELL_DEG,
    };
    expect(coverage([{ i: 0, j: 0 }], bounds)).toBe(1);
  });

  it("calcule la part explorée d’une zone", () => {
    const bounds = {
      minLat: 0,
      maxLat: CELL_DEG * 1.5,
      minLng: 0,
      maxLng: CELL_DEG * 1.5,
    };
    expect(coverage([{ i: 0, j: 0 }], bounds)).toBe(0.25); // 1 cellule sur 4
  });
});
