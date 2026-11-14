import { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 1;

export const migrateDbIfNeeded = async (db: SQLiteDatabase): Promise<void> => {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGME user_version",
  );
  let currentVersion = row?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE cells (
        lat_index     INTEGER NOT NULL,
        lng_index     INTEGER NOT NULL,
        first_seen_at INTEGER NOT NULL,
        PRIMARY KEY (lat_index, lng_index)
      ) WITHOUT ROWID;
      CREATE INDEX idx_cells_seen ON cells(first_seen_at);
      CREATE TABLE stats (
        key   TEXT PRIMARY KEY,
        value REAL NOT NULL
      );
    `);
    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
};
