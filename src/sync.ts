import { fetchConstructorStandings, fetchDriverStandings, fetchQualifying, fetchResults, fetchSchedule, fetchSprintQualifying, fetchSprintResults } from "./lib/jolpica";
import { JolpicaRace, JolpicaResult, JolpicaQualifyingResult, JolpicaSprintQualifyingResult, JolpicaDriverStanding, JolpicaConstructorStanding } from "./types";
import { setTimeout } from 'node:timers/promises';

const DELAY_MS = 2000;

// ---- DB upsert helpers ----

// Upsert a race row, returning its DB id
async function upsertRace(db: D1Database, season: number, race: JolpicaRace): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO races (season, round, name, circuit_name, circuit_id, locality, country, date, time, wikipedia_url, sprint_date, sprint_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(season, round) DO UPDATE SET
         name = excluded.name,
         circuit_name = excluded.circuit_name,
         circuit_id = excluded.circuit_id,
         locality = excluded.locality,
         country = excluded.country,
         date = excluded.date,
         time = excluded.time,
         wikipedia_url = excluded.wikipedia_url,
         sprint_date = excluded.sprint_date,
         sprint_time = excluded.sprint_time
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
      race.url,
      race.Sprint?.date ?? null,
      race.Sprint?.time ?? null
    )
    .first<{ id: number }>();

  if (!result) throw new Error(`Failed to upsert race ${season}/${race.round}`);
  return result.id;
}

// Replace all race entries for a race
async function upsertRaceEntries(db: D1Database, raceId: number, results: JolpicaResult[]): Promise<void> {
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

// Replace all qualifying entries for a race
async function upsertQualifyingEntries(db: D1Database, raceId: number, results: JolpicaQualifyingResult[]): Promise<void> {
  await db.prepare('DELETE FROM qualifying_entries WHERE race_id = ?').bind(raceId).run();

  const stmts = results.map((r) =>
    db
      .prepare(
        `INSERT INTO qualifying_entries
           (race_id, jolpica_driver_id, driver_code, driver_name, constructor, position, q1, q2, q3)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        raceId,
        r.Driver.driverId,
        r.Driver.code ?? '',
        `${r.Driver.givenName} ${r.Driver.familyName}`,
        r.Constructor.name,
        parseInt(r.position),
        r.Q1 ?? null,
        r.Q2 ?? null,
        r.Q3 ?? null
      )
  );

  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}

// Replace all sprint race entries for a race
async function upsertSprintEntries(db: D1Database, raceId: number, results: JolpicaResult[]): Promise<void> {
  await db.prepare('DELETE FROM sprint_entries WHERE race_id = ?').bind(raceId).run();

  const stmts = results.map((r) => {
    const isFastestLap = r.FastestLap?.rank === '1' ? 1 : 0;
    const finishPos = r.positionText === 'R' || r.positionText === 'D' || r.positionText === 'E' || r.positionText === 'W' || r.positionText === 'F' || r.positionText === 'N'
      ? null
      : parseInt(r.position);

    return db
      .prepare(
        `INSERT INTO sprint_entries
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

// Replace all sprint qualifying entries for a race
async function upsertSprintQualifyingEntries(db: D1Database, raceId: number, results: JolpicaSprintQualifyingResult[]): Promise<void> {
  await db.prepare('DELETE FROM sprint_qualifying_entries WHERE race_id = ?').bind(raceId).run();

  const stmts = results.map((r) =>
    db
      .prepare(
        `INSERT INTO sprint_qualifying_entries
           (race_id, jolpica_driver_id, driver_code, driver_name, constructor, position, sq1, sq2, sq3)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        raceId,
        r.Driver.driverId,
        r.Driver.code ?? '',
        `${r.Driver.givenName} ${r.Driver.familyName}`,
        r.Constructor.name,
        parseInt(r.position),
        r.Q1 ?? null,
        r.Q2 ?? null,
        r.Q3 ?? null
      )
  );

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

// ---- Session sync sub-methods ----

// Sync qualifying results. Skips if records already exist in the DB.
async function syncQualifying(db: D1Database, raceId: number, season: number, round: number, log: string[]): Promise<void> {
  const existing = await db.prepare('SELECT 1 FROM qualifying_entries WHERE race_id = ? LIMIT 1').bind(raceId).first();
  if (existing) {
    log.push(`  Qualifying: already stored, skipping.`);
    return;
  }

  await setTimeout(DELAY_MS);
  const results = await fetchQualifying(season, round);
  if (results.length > 0) {
    await upsertQualifyingEntries(db, raceId, results);
    log.push(`  Qualifying: stored ${results.length} entries.`);
  } else {
    log.push(`  Qualifying: no results available yet.`);
  }
}

// Sync sprint qualifying results. Skips if records already exist in the DB.
async function syncSprintQualifying(db: D1Database, raceId: number, season: number, round: number, log: string[]): Promise<void> {
  const existing = await db.prepare('SELECT 1 FROM sprint_qualifying_entries WHERE race_id = ? LIMIT 1').bind(raceId).first();
  if (existing) {
    log.push(`  Sprint qualifying: already stored, skipping.`);
    return;
  }

  await setTimeout(DELAY_MS);
  const results = await fetchSprintQualifying(season, round);
  if (results.length > 0) {
    await upsertSprintQualifyingEntries(db, raceId, results);
    log.push(`  Sprint qualifying: stored ${results.length} entries.`);
  } else {
    log.push(`  Sprint qualifying: no results available yet.`);
  }
}

// Sync sprint race results. Skips if records already exist in the DB.
async function syncSprintResults(db: D1Database, raceId: number, season: number, round: number, log: string[]): Promise<void> {
  const existing = await db.prepare('SELECT 1 FROM sprint_entries WHERE race_id = ? LIMIT 1').bind(raceId).first();
  if (existing) {
    log.push(`  Sprint: already stored, skipping.`);
    return;
  }

  await setTimeout(DELAY_MS);
  const results = await fetchSprintResults(season, round);
  if (results.length > 0) {
    await upsertSprintEntries(db, raceId, results);
    log.push(`  Sprint: stored ${results.length} entries.`);
  } else {
    log.push(`  Sprint: no results available yet.`);
  }
}

// Sync race results. Always fetches from the API (race results can be corrected post-event).
// Returns true if results were found and stored.
async function syncRaceResults(db: D1Database, raceId: number, season: number, round: number, log: string[]): Promise<boolean> {
  await setTimeout(DELAY_MS);
  const results = await fetchResults(season, round);
  if (results.length > 0) {
    await upsertRaceEntries(db, raceId, results);
    log.push(`  Race: stored ${results.length} entries.`);
    return true;
  }
  log.push(`  Race: no results available yet.`);
  return false;
}

// Standings cache passed between rounds so the previous round's "after" can be reused as the next round's "before"
interface StandingsCache {
  round: number;
  driverStandings: JolpicaDriverStanding[];
  constructorStandings: JolpicaConstructorStanding[];
}

// Sync standings snapshot before this race (i.e. standings after the previous round).
// Uses the cache if available, otherwise fetches from the API.
async function syncStandingsBeforeTheRace(
  db: D1Database,
  raceId: number,
  season: number,
  round: number,
  log: string[],
  cache: StandingsCache | null
): Promise<void> {
  const prevRound = round - 1;
  let driverBefore: JolpicaDriverStanding[];
  let constructorBefore: JolpicaConstructorStanding[];

  if (cache?.round === prevRound) {
    driverBefore = cache.driverStandings;
    constructorBefore = cache.constructorStandings;
    log.push(`  Before standings: using cached data from round ${prevRound}.`);
  } else {
    await setTimeout(DELAY_MS);
    driverBefore = await fetchDriverStandings(season, prevRound);
    await setTimeout(DELAY_MS);
    constructorBefore = await fetchConstructorStandings(season, prevRound);
    log.push(`  Before standings: fetched from API (round ${prevRound}).`);
  }

  if (driverBefore.length > 0 || constructorBefore.length > 0) {
    await upsertStandingsSnapshots(db, raceId, 'before', driverBefore, constructorBefore);
    log.push(`  Before standings stored (${driverBefore.length} drivers, ${constructorBefore.length} constructors).`);
  } else {
    log.push(`  Before standings: none available (round ${prevRound} — likely start of season).`);
  }
}

// Sync standings snapshot after this race. Always fetches from the API.
// Returns the fetched standings so they can be cached for the next round.
async function syncStandingsAfterTheRace(
  db: D1Database,
  raceId: number,
  season: number,
  round: number,
  log: string[]
): Promise<StandingsCache | null> {
  await setTimeout(DELAY_MS);
  const driverAfter = await fetchDriverStandings(season, round);
  await setTimeout(DELAY_MS);
  const constructorAfter = await fetchConstructorStandings(season, round);

  if (driverAfter.length > 0 || constructorAfter.length > 0) {
    await upsertStandingsSnapshots(db, raceId, 'after', driverAfter, constructorAfter);
    log.push(`  After standings stored (round ${round}: ${driverAfter.length} drivers, ${constructorAfter.length} constructors).`);
    return { round, driverStandings: driverAfter, constructorStandings: constructorAfter };
  }

  log.push(`  After standings: none available for round ${round}, skipping.`);
  return null;
}

// ---- Main sync function ----

export interface SyncResult {
  season: number;
  racesProcessed: number;
  racesSkipped: number;
  log: string[];
}

// Main sync function: fetches all data for a season and writes to D1
export async function syncSeason(season: number, db: D1Database, fromRound = 1, toRound?: number): Promise<SyncResult> {
  const log: string[] = [];
  let racesProcessed = 0;
  let racesSkipped = 0;

  log.push(`Fetching schedule for ${season}...`);
  const races = await fetchSchedule(season);
  log.push(`Found ${races.length} races.`);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Cache the last round's "after" standings so we can use them as the next round's "before"
  let standingsCache: StandingsCache | null = null;

  for (const race of races) {
    const round = parseInt(race.round);

    if (round < fromRound) continue;
    if (toRound !== undefined && round > toRound) continue;

    const raceLabel = `Round ${round}: ${race.raceName}`;
    const isSprintWeekend = !!race.Sprint;

    // Upsert the race row regardless of completion
    const raceId = await upsertRace(db, season, race);

    const raceDateTime = race.time ? new Date(`${race.date}T${race.time}`) : new Date(`${race.date}T00:00:00Z`);
    const now = Date.now();
    const msUntilRace = raceDateTime.getTime() - now;
    const isPastRaceTime = msUntilRace <= 0;
    // "Race weekend" = within 3 days of race time (covers Thu/Fri practice through Sunday)
    const isRaceWeekend = msUntilRace <= 3 * 24 * 60 * 60 * 1000;
    const isUpcoming = race.date > today;

    if (isUpcoming && !isRaceWeekend) {
      log.push(`${raceLabel} — upcoming, skipping.`);
      racesSkipped++;
      continue;
    }

    if (!isPastRaceTime) {
      // We're in the race weekend window but the race hasn't happened yet.
      // Sync pre-race sessions only, skipping any that are already stored.
      log.push(`${raceLabel} — race weekend in progress, syncing pre-race sessions...`);

      await syncQualifying(db, raceId, season, round, log);

      if (isSprintWeekend) {
        await syncSprintQualifying(db, raceId, season, round, log);
        await syncSprintResults(db, raceId, season, round, log);
      }

      racesSkipped++;
      continue;
    }

    // Past race time: sync all sessions.
    log.push(`${raceLabel} — past race time, syncing all sessions...`);

    await syncQualifying(db, raceId, season, round, log);

    if (isSprintWeekend) {
      await syncSprintQualifying(db, raceId, season, round, log);
      await syncSprintResults(db, raceId, season, round, log);
    }

    const hasRaceResults = await syncRaceResults(db, raceId, season, round, log);

    if (!hasRaceResults) {
      // Race results aren't in yet — treat as partially processed
      racesSkipped++;
      continue;
    }

    await syncStandingsBeforeTheRace(db, raceId, season, round, log, standingsCache);
    const newCache = await syncStandingsAfterTheRace(db, raceId, season, round, log);
    if (newCache) standingsCache = newCache;

    racesProcessed++;
  }

  return { season, racesProcessed, racesSkipped, log };
}
