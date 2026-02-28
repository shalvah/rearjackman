import type {
  JolpicaResponse,
  JolpicaRace,
  JolpicaResult,
  JolpicaDriverStanding,
  JolpicaConstructorStanding,
} from './types';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

// Small delay between requests to be a good citizen to the API
const DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jolpicaFetch<T>(path: string): Promise<JolpicaResponse<T>> {
  const url = `${JOLPICA_BASE}${path}?limit=100`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jolpica fetch failed: ${res.status} ${url}`);
  }
  return res.json() as Promise<JolpicaResponse<T>>;
}

// Fetch the schedule (all races) for a season
async function fetchSchedule(season: number): Promise<JolpicaRace[]> {
  const data = await jolpicaFetch<JolpicaRace>(`/${season}`);
  return data.MRData.RaceTable?.Races ?? [];
}

// Fetch race results for a specific round (includes grid positions)
async function fetchResults(season: number, round: number): Promise<JolpicaResult[]> {
  const data = await jolpicaFetch<JolpicaRace>(`/${season}/${round}/results`);
  const races = data.MRData.RaceTable?.Races ?? [];
  return races[0]?.Results ?? [];
}

// Fetch driver standings after a specific round (round=0 = pre-season / empty)
async function fetchDriverStandings(season: number, round: number): Promise<JolpicaDriverStanding[]> {
  if (round === 0) return [];
  const data = await jolpicaFetch<never>(`/${season}/${round}/driverStandings`);
  const lists = data.MRData.StandingsTable?.StandingsLists ?? [];
  return lists[0]?.DriverStandings ?? [];
}

// Fetch constructor standings after a specific round
async function fetchConstructorStandings(season: number, round: number): Promise<JolpicaConstructorStanding[]> {
  if (round === 0) return [];
  const data = await jolpicaFetch<never>(`/${season}/${round}/constructorStandings`);
  const lists = data.MRData.StandingsTable?.StandingsLists ?? [];
  return lists[0]?.ConstructorStandings ?? [];
}

// Upsert a race row, returning its DB id
async function upsertRace(db: D1Database, season: number, race: JolpicaRace): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO races (season, round, name, circuit_name, circuit_id, locality, country, date, time, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(season, round) DO UPDATE SET
         name = excluded.name,
         circuit_name = excluded.circuit_name,
         circuit_id = excluded.circuit_id,
         locality = excluded.locality,
         country = excluded.country,
         date = excluded.date,
         time = excluded.time,
         url = excluded.url
       RETURNING id`
    )
    .bind(
      season,
      parseInt(race.round),
      race.raceName,
      race.Circuit.circuitName,
      race.Circuit.circuitId,
      race.Circuit.Location.locality,
      race.Circuit.Location.country,
      race.date,
      race.time ?? null,
      race.url
    )
    .first<{ id: number }>();

  if (!result) throw new Error(`Failed to upsert race ${season}/${race.round}`);
  return result.id;
}

// Replace all race entries for a race
async function upsertRaceEntries(db: D1Database, raceId: number, results: JolpicaResult[]): Promise<void> {
  // Delete existing entries for this race first
  await db.prepare('DELETE FROM race_entries WHERE race_id = ?').bind(raceId).run();

  const stmts = results.map((r) => {
    const isFastestLap = r.FastestLap?.rank === '1' ? 1 : 0;
    const finishPos = r.positionText === 'R' || r.positionText === 'D' || r.positionText === 'E' || r.positionText === 'W' || r.positionText === 'F' || r.positionText === 'N'
      ? null
      : parseInt(r.position);

    return db
      .prepare(
        `INSERT INTO race_entries
           (race_id, driver_id, driver_code, driver_name, constructor, grid_position, finish_position, status, points, fastest_lap)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        raceId,
        r.Driver.driverId,
        r.Driver.code ?? '',
        `${r.Driver.givenName} ${r.Driver.familyName}`,
        r.Constructor.name,
        r.grid === '0' ? null : parseInt(r.grid),
        finishPos,
        r.status,
        parseFloat(r.points),
        isFastestLap
      );
  });

  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}

// Replace all standings snapshots for a race of a given type
async function upsertStandingsSnapshots(
  db: D1Database,
  raceId: number,
  snapshotType: 'before' | 'after',
  driverStandings: JolpicaDriverStanding[],
  constructorStandings: JolpicaConstructorStanding[]
): Promise<void> {
  // Delete existing snapshots for this race + type
  await db
    .prepare('DELETE FROM standings_snapshots WHERE race_id = ? AND snapshot_type = ?')
    .bind(raceId, snapshotType)
    .run();

  const stmts = [
    ...driverStandings.map((s) =>
      db
        .prepare(
          `INSERT INTO standings_snapshots
             (race_id, snapshot_type, entity_type, position, entity_id, entity_name, points, wins)
           VALUES (?, ?, 'driver', ?, ?, ?, ?, ?)`
        )
        .bind(
          raceId,
          snapshotType,
          parseInt(s.position),
          s.Driver.driverId,
          `${s.Driver.givenName} ${s.Driver.familyName}`,
          parseFloat(s.points),
          parseInt(s.wins)
        )
    ),
    ...constructorStandings.map((s) =>
      db
        .prepare(
          `INSERT INTO standings_snapshots
             (race_id, snapshot_type, entity_type, position, entity_id, entity_name, points, wins)
           VALUES (?, ?, 'constructor', ?, ?, ?, ?, ?)`
        )
        .bind(
          raceId,
          snapshotType,
          parseInt(s.position),
          s.Constructor.constructorId,
          s.Constructor.name,
          parseFloat(s.points),
          parseInt(s.wins)
        )
    ),
  ];

  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}

export interface SyncResult {
  season: number;
  racesProcessed: number;
  racesSkipped: number;
  log: string[];
}

// Main sync function: fetches all data for a season and writes to D1
export async function syncSeason(season: number, db: D1Database): Promise<SyncResult> {
  const log: string[] = [];
  let racesProcessed = 0;
  let racesSkipped = 0;

  log.push(`Fetching schedule for ${season}...`);
  const races = await fetchSchedule(season);
  log.push(`Found ${races.length} races.`);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const race of races) {
    const round = parseInt(race.round);
    const raceDate = race.date;
    const raceLabel = `Round ${round}: ${race.raceName}`;

    // Upsert the race row regardless of completion
    const raceId = await upsertRace(db, season, race);

    // Only fetch results + standings if the race has occurred
    if (raceDate > today) {
      log.push(`${raceLabel} — upcoming, skipping results.`);
      racesSkipped++;
      await sleep(DELAY_MS);
      continue;
    }

    log.push(`${raceLabel} — fetching results...`);
    await sleep(DELAY_MS);
    const results = await fetchResults(season, round);

    if (results.length === 0) {
      log.push(`  No results yet, skipping.`);
      racesSkipped++;
      continue;
    }

    await upsertRaceEntries(db, raceId, results);
    log.push(`  Stored ${results.length} entries.`);

    // "before" standings = standings after the previous round
    await sleep(DELAY_MS);
    const prevRound = round - 1;
    const driverBefore = await fetchDriverStandings(season, prevRound);
    await sleep(DELAY_MS);
    const constructorBefore = await fetchConstructorStandings(season, prevRound);
    await upsertStandingsSnapshots(db, raceId, 'before', driverBefore, constructorBefore);

    // "after" standings = standings after this round
    await sleep(DELAY_MS);
    const driverAfter = await fetchDriverStandings(season, round);
    await sleep(DELAY_MS);
    const constructorAfter = await fetchConstructorStandings(season, round);
    await upsertStandingsSnapshots(db, raceId, 'after', driverAfter, constructorAfter);

    log.push(`  Standings stored (before round ${prevRound}, after round ${round}).`);
    racesProcessed++;
  }

  return { season, racesProcessed, racesSkipped, log };
}
