import type { SQLiteDatabase } from "expo-sqlite";
import {
  type Bounds,
  type Cell,
  CELL_DEG,
  cellAreaM2,
  cellRange,
} from "../geo/grid";

export type ExplorationStats = {
  cellCount: number;
  areaKm2: number;
  todayCount: number;
  distanceKm: number;
  since: number | null;
};

/** Enregistre des cellules ; retourne le nombre de cellules réellement nouvelles. */
export async function revealCells(
  db: SQLiteDatabase,
  cells: Cell[],
  at: number,
): Promise<number> {
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const cell of cells) {
      const result = await db.runAsync(
        "INSERT OR IGNORE INTO cells (lat_index, lng_index, first_seen_at) VALUES (?, ?, ?)",
        cell.i,
        cell.j,
        at,
      );
      added += result.changes;
    }
  });
  return added;
}

export async function cellsInBounds(
  db: SQLiteDatabase,
  bounds: Bounds,
): Promise<Cell[]> {
  const r = cellRange(bounds);
  return db.getAllAsync<Cell>(
    `SELECT lat_index AS i, lng_index AS j FROM cells
     WHERE lat_index BETWEEN ? AND ? AND lng_index BETWEEN ? AND ?`,
    r.minI,
    r.maxI,
    r.minJ,
    r.maxJ,
  );
}

/** Ajoute des mètres au total parcouru (insertion ou mise à jour en une requête). */
export async function addDistance(
  db: SQLiteDatabase,
  meters: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO stats (key, value) VALUES ('distance_m', ?)
     ON CONFLICT(key) DO UPDATE SET value = value + excluded.value`,
    meters,
  );
}

export async function getStats(
  db: SQLiteDatabase,
  startOfToday: number,
): Promise<ExplorationStats> {
  const totals = await db.getFirstAsync<{
    count: number;
    avgI: number | null;
    since: number | null;
  }>(
    "SELECT COUNT(*) AS count, AVG(lat_index) AS avgI, MIN(first_seen_at) AS since FROM cells",
  );
  const today = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM cells WHERE first_seen_at >= ?",
    startOfToday,
  );
  const distance = await db.getFirstAsync<{ value: number }>(
    "SELECT value FROM stats WHERE key = 'distance_m'",
  );

  const count = totals?.count ?? 0;
  const averageLatitude = (totals?.avgI ?? 0) * CELL_DEG;
  return {
    cellCount: count,
    areaKm2: (count * cellAreaM2(averageLatitude)) / 1_000_000,
    todayCount: today?.count ?? 0,
    distanceKm: (distance?.value ?? 0) / 1000,
    since: totals?.since ?? null,
  };
}

export async function resetExploration(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("DELETE FROM cells; DELETE FROM stats;");
}
