CREATE TABLE IF NOT EXISTS qualifying_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL REFERENCES races(id),
  jolpica_driver_id TEXT NOT NULL,
  driver_code TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  constructor TEXT NOT NULL,
  position INTEGER NOT NULL,
  q1 TEXT,
  q2 TEXT,
  q3 TEXT
);

CREATE INDEX IF NOT EXISTS idx_qualifying_entries_race_id ON qualifying_entries(race_id);
