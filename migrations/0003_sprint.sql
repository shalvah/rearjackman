-- Add sprint date/time columns to races table for sprint weekend detection
ALTER TABLE races ADD COLUMN sprint_date TEXT;
ALTER TABLE races ADD COLUMN sprint_time TEXT;

-- Sprint race results (same shape as race_entries)
CREATE TABLE IF NOT EXISTS sprint_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL REFERENCES races(id),
  jolpica_driver_id TEXT NOT NULL,
  driver_code TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  constructor TEXT NOT NULL,
  grid_position INTEGER,
  finish_position INTEGER,
  status TEXT NOT NULL,
  points REAL NOT NULL DEFAULT 0,
  fastest_lap INTEGER NOT NULL DEFAULT 0  -- 0 | 1
);

CREATE INDEX IF NOT EXISTS idx_sprint_entries_race_id ON sprint_entries(race_id);

-- Sprint qualifying results (sq1/sq2/sq3 instead of q1/q2/q3)
CREATE TABLE IF NOT EXISTS sprint_qualifying_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL REFERENCES races(id),
  jolpica_driver_id TEXT NOT NULL,
  driver_code TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  constructor TEXT NOT NULL,
  position INTEGER NOT NULL,
  sq1 TEXT,
  sq2 TEXT,
  sq3 TEXT
);

CREATE INDEX IF NOT EXISTS idx_sprint_qualifying_entries_race_id ON sprint_qualifying_entries(race_id);
