import type {
  JolpicaResponse,
  JolpicaRace,
  JolpicaResult,
  JolpicaDriverStanding,
  JolpicaConstructorStanding,
} from './types';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

const DELAY_MS = 2000;
const MAX_RETRIES = 5;

// TODO replace with node:timers/promises. See https://developers.cloudflare.com/workers/runtime-apis/nodejs/timers/
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(header: string | null, fallbackMs: number): number {
  if (!header) return fallbackMs;
  // Try as a number of seconds first
  const seconds = parseFloat(header);
  if (!isNaN(seconds)) return Math.ceil(seconds) * 1000;
  // Try as an HTTP date string (e.g. "Fri, 01 Mar 2026 12:00:00 GMT")
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return fallbackMs;
}

async function jolpicaFetch<T>(path: string): Promise<JolpicaResponse<T>> {
  const url = `${JOLPICA_BASE}${path}?limit=100`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[sync] GET ${path}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
    const res = await fetch(url);

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const fallbackMs = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s, 40s, 80s
      const waitMs = parseRetryAfterMs(retryAfter, fallbackMs);
      if (attempt < MAX_RETRIES) {
        console.warn(`[sync] 429 rate limited on ${path} — backing off ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})${retryAfter ? ` [Retry-After: ${retryAfter}]` : ''}`);
        await sleep(waitMs);
        continue;
      }
      console.error(`[sync] 429 rate limited on ${path} — max retries reached`);
    }

    if (!res.ok) {
      console.error(`[sync] HTTP ${res.status} on ${path}`);
      throw new Error(`Jolpica fetch failed: ${res.status} ${url}`);
    }

    return res.json() as Promise<JolpicaResponse<T>>;
  }

  throw new Error(`Jolpica fetch failed after ${MAX_RETRIES} retries: ${url}`);
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
      `INSERT INTO races (season, round, name, circuit_name, circuit_id, locality, country, date, time, wikipedia_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(season, round) DO UPDATE SET
         name = excluded.name,
         circuit_name = excluded.circuit_name,
         circuit_id = excluded.circuit_id,
         locality = excluded.locality,
         country = excluded.country,
         date = excluded.date,
         time = excluded.time,
         wikipedia_url = excluded.wikipedia_url
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
           (race_id, jolpica_driver_id, driver_code, driver_name, constructor, grid_position, finish_position, status, points, fastest_lap)
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
    ...driverStandings.flatMap((s) => {
      const position = parseInt(s.position ?? '');
      if (isNaN(position)) return []; // skip unclassified entries (positionText: "-")
      return [db
        .prepare(
          `INSERT INTO standings_snapshots
             (race_id, snapshot_type, entity_type, position, entity_id, entity_name, points, wins)
           VALUES (?, ?, 'driver', ?, ?, ?, ?, ?)`
        )
        .bind(
          raceId,
          snapshotType,
          position,
          s.Driver.driverId,
          `${s.Driver.givenName} ${s.Driver.familyName}`,
          parseFloat(s.points),
          parseInt(s.wins)
        )];
    }),
    ...constructorStandings.flatMap((s) => {
      const position = parseInt(s.position ?? '');
      if (isNaN(position)) return []; // skip unclassified entries
      return [db
        .prepare(
          `INSERT INTO standings_snapshots
             (race_id, snapshot_type, entity_type, position, entity_id, entity_name, points, wins)
           VALUES (?, ?, 'constructor', ?, ?, ?, ?, ?)`
        )
        .bind(
          raceId,
          snapshotType,
          position,
          s.Constructor.constructorId,
          s.Constructor.name,
          parseFloat(s.points),
          parseInt(s.wins)
        )];
    }),
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
export async function syncSeason(season: number, db: D1Database, fromRound = 1): Promise<SyncResult> {
  const log: string[] = [];
  let racesProcessed = 0;
  let racesSkipped = 0;

  log.push(`Fetching schedule for ${season}...`);
  const races = await fetchSchedule(season);
  log.push(`Found ${races.length} races.`);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Cache the last round's "after" standings so we can use them as the next round's "before"
  let cachedDriverStandings: JolpicaDriverStanding[] = [];
  let cachedConstructorStandings: JolpicaConstructorStanding[] = [];
  let cachedRound = 0;

  for (const race of races) {
    const round = parseInt(race.round);
    
    if (round < fromRound) {
      continue;
    }

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

    // "before" standings: use cached "after" from previous round if available,
    // otherwise fetch from API (covers the case where sync is resumed mid-season)
    const prevRound = round - 1;
    let driverBefore: JolpicaDriverStanding[];
    let constructorBefore: JolpicaConstructorStanding[];

    if (cachedRound === prevRound) {
      driverBefore = cachedDriverStandings;
      constructorBefore = cachedConstructorStandings;
      log.push(`  Before standings: using cached data from round ${prevRound}.`);
    } else {
      await sleep(DELAY_MS);
      driverBefore = await fetchDriverStandings(season, prevRound);
      await sleep(DELAY_MS);
      constructorBefore = await fetchConstructorStandings(season, prevRound);
      log.push(`  Before standings: fetched from API (round ${prevRound}).`);
    }

    if (driverBefore.length > 0 || constructorBefore.length > 0) {
      await upsertStandingsSnapshots(db, raceId, 'before', driverBefore, constructorBefore);
      log.push(`  Before standings stored (${driverBefore.length} drivers, ${constructorBefore.length} constructors).`);
    } else {
      log.push(`  No before standings available (round ${prevRound} — likely start of season).`);
    }

    // "after" standings: always fetch from API
    await sleep(DELAY_MS);
    const driverAfter = await fetchDriverStandings(season, round);
    await sleep(DELAY_MS);
    const constructorAfter = await fetchConstructorStandings(season, round);

    if (driverAfter.length > 0 || constructorAfter.length > 0) {
      await upsertStandingsSnapshots(db, raceId, 'after', driverAfter, constructorAfter);
      log.push(`  After standings stored (round ${round}: ${driverAfter.length} drivers, ${constructorAfter.length} constructors).`);
      // Cache for next round's "before"
      cachedDriverStandings = driverAfter;
      cachedConstructorStandings = constructorAfter;
      cachedRound = round;
    } else {
      log.push(`  No after standings available for round ${round} — skipping.`);
    }

    racesProcessed++;
  }

  return { season, racesProcessed, racesSkipped, log };
}
