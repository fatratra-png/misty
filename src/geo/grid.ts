export type LatLng = { latitude: number; longitude: number };
export type Cell = { i: number; j: number }; // i = ligne (latitude), j = colonne (longitude)
export type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};
export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
export type Fog = { outer: LatLng[]; holes: LatLng[][] };

export const CELL_DEG = 0.0003; // ≈ 33 m en latitude
export const METERS_PER_DEG_LAT = 111_320;
export const REVEAL_RADIUS_M = 40; // rayon dissipé autour de toi
export const MAX_FOG_CELLS = 40_000; // au-delà, on regroupe les cellules

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function cellOf(point: LatLng): Cell {
  // Math.floor (et non Math.trunc) : -0,5 doit donner -1, pas 0.
  return {
    i: Math.floor(point.latitude / CELL_DEG),
    j: Math.floor(point.longitude / CELL_DEG),
  };
}

export function cellCenter(cell: Cell): LatLng {
  return {
    latitude: (cell.i + 0.5) * CELL_DEG,
    longitude: (cell.j + 0.5) * CELL_DEG,
  };
}

/** Distance à vol d'oiseau (formule de haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Surface d'une cellule : les colonnes rétrécissent en s'éloignant de l'équateur. */
export function cellAreaM2(latitude: number): number {
  const side = CELL_DEG * METERS_PER_DEG_LAT;
  return side * side * Math.cos(toRad(latitude));
}

/** Les cellules dont le centre est à moins de `radiusM` du point. */
export function cellsAround(point: LatLng, radiusM = REVEAL_RADIUS_M): Cell[] {
  const center = cellOf(point);
  const cellHeightM = CELL_DEG * METERS_PER_DEG_LAT;
  const cellWidthM =
    cellHeightM * Math.max(Math.cos(toRad(point.latitude)), 0.01);
  const spanI = Math.ceil(radiusM / cellHeightM) + 1;
  const spanJ = Math.ceil(radiusM / cellWidthM) + 1;

  const cells: Cell[] = [];
  for (let di = -spanI; di <= spanI; di++) {
    for (let dj = -spanJ; dj <= spanJ; dj++) {
      const cell = { i: center.i + di, j: center.j + dj };
      if (distanceMeters(point, cellCenter(cell)) <= radiusM) cells.push(cell);
    }
  }
  return cells;
}

/** Rectangle géographique couvert par une région de carte (scale > 1 = plus large). */
export function regionToBounds(region: Region, scale = 1): Bounds {
  const halfLat = (region.latitudeDelta * scale) / 2;
  const halfLng = (region.longitudeDelta * scale) / 2;
  return {
    minLat: Math.max(region.latitude - halfLat, -85),
    maxLat: Math.min(region.latitude + halfLat, 85),
    minLng: Math.max(region.longitude - halfLng, -180),
    maxLng: Math.min(region.longitude + halfLng, 180),
  };
}

/** Plage d'indices de cellules couverte par un rectangle (sert aux requêtes SQL). */
export function cellRange(bounds: Bounds) {
  return {
    minI: Math.floor(bounds.minLat / CELL_DEG),
    maxI: Math.floor(bounds.maxLat / CELL_DEG),
    minJ: Math.floor(bounds.minLng / CELL_DEG),
    maxJ: Math.floor(bounds.maxLng / CELL_DEG),
  };
}

/**
 * Fusionne les cellules voisines d'une même ligne en rectangles.
 * `factor` > 1 regroupe d'abord les cellules en blocs de factor × factor.
 */
export function mergeIntoRows(cells: Cell[], factor = 1): Bounds[] {
  const size = CELL_DEG * factor;
  const rows = new Map<number, Set<number>>();
  for (const cell of cells) {
    const i = Math.floor(cell.i / factor);
    const j = Math.floor(cell.j / factor);
    const row = rows.get(i) ?? new Set<number>();
    row.add(j);
    rows.set(i, row);
  }

  const rects: Bounds[] = [];
  for (const [i, columns] of rows) {
    const cols = [...columns].sort((a, b) => a - b);
    let start = cols[0];
    for (let k = 1; k <= cols.length; k++) {
      // Tant que les colonnes se suivent, on prolonge le rectangle.
      if (k < cols.length && cols[k] === cols[k - 1] + 1) continue;
      rects.push({
        minLat: i * size,
        maxLat: (i + 1) * size,
        minLng: start * size,
        maxLng: (cols[k - 1] + 1) * size,
      });
      if (k < cols.length) start = cols[k];
    }
  }
  return rects;
}

function corners(b: Bounds): LatLng[] {
  return [
    { latitude: b.minLat, longitude: b.minLng },
    { latitude: b.minLat, longitude: b.maxLng },
    { latitude: b.maxLat, longitude: b.maxLng },
    { latitude: b.maxLat, longitude: b.minLng },
  ];
}

/** Le polygone de brouillard : un rectangle extérieur percé d'un trou par zone explorée. */
export function buildFog(cells: Cell[], bounds: Bounds): Fog {
  const range = cellRange(bounds);
  const rangeCells =
    (range.maxI - range.minI + 1) * (range.maxJ - range.minJ + 1);
  const factor = Math.max(1, Math.ceil(Math.sqrt(rangeCells / MAX_FOG_CELLS)));

  const holes: LatLng[][] = [];
  for (const rect of mergeIntoRows(cells, factor)) {
    // Un trou doit rester à l'intérieur du polygone extérieur.
    const clipped: Bounds = {
      minLat: Math.max(rect.minLat, bounds.minLat),
      maxLat: Math.min(rect.maxLat, bounds.maxLat),
      minLng: Math.max(rect.minLng, bounds.minLng),
      maxLng: Math.min(rect.maxLng, bounds.maxLng),
    };
    if (clipped.minLat < clipped.maxLat && clipped.minLng < clipped.maxLng) {
      holes.push(corners(clipped));
    }
  }
  return { outer: corners(bounds), holes };
}

/** Part (0 à 1) des cellules d'un rectangle qui ont été explorées. */
export function coverage(cells: Cell[], bounds: Bounds): number {
  const r = cellRange(bounds);
  const total = (r.maxI - r.minI + 1) * (r.maxJ - r.minJ + 1);
  if (total <= 0) return 0;
  const explored = cells.filter(
    (c) => c.i >= r.minI && c.i <= r.maxI && c.j >= r.minJ && c.j <= r.maxJ,
  ).length;
  return explored / total;
}
