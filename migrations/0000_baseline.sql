CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  name TEXT NOT NULL,
  circuit_name TEXT NOT NULL,
  circuit_id TEXT NOT NULL,
  locality TEXT,
  country TEXT,
  date TEXT NOT NULL,
  time TEXT,
  url TEXT,
  UNIQUE(season, round)
);

CREATE TABLE IF NOT EXISTS race_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL REFERENCES races(id),
  driver_id TEXT NOT NULL,
  driver_code TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  constructor TEXT NOT NULL,
  grid_position INTEGER,
  finish_position INTEGER,
  status TEXT NOT NULL,
  points REAL NOT NULL DEFAULT 0,
  fastest_lap INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS standings_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL REFERENCES races(id),
  snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('before', 'after')),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('driver', 'constructor')),
  position INTEGER NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  points REAL NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_races_season_round ON races(season, round);
CREATE INDEX IF NOT EXISTS idx_race_entries_race_id ON race_entries(race_id);
CREATE INDEX IF NOT EXISTS idx_standings_snapshots_race_id ON standings_snapshots(race_id);
