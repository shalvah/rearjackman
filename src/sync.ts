import { fetchConstructorStandings, fetchDriverStandings, fetchQualifying, fetchResults, fetchSchedule, fetchSprintQualifying, fetchSprintResults } from "./lib/jolpica";
import { JolpicaRace, JolpicaResult, JolpicaQualifyingResult, JolpicaSprintQualifyingResult, JolpicaDriverStanding, JolpicaConstructorStanding } from "./types";
import { setTimeout } from 'node:timers/promises';

const DELAY_MS = 2000;

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
export async function syncSeason(season: number, db: D1Database, fromRound = 1, toRound?: number): Promise<SyncResult> {
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

    if (toRound !== undefined && round > toRound) {
      continue;
    }

    const raceDate = race.date;
    const raceLabel = `Round ${round}: ${race.raceName}`;

    // Upsert the race row regardless of completion
    const raceId = await upsertRace(db, season, race);

    // Determine if the race is upcoming, imminent (within 3 days), or past
    const raceDateTime = race.time ? new Date(`${race.date}T${race.time}`) : new Date(`${race.date}T00:00:00Z`);
    const msUntilRace = raceDateTime.getTime() - Date.now();
    const isUpcoming = raceDate > today;
    const isImminent = isUpcoming && msUntilRace <= 3 * 24 * 60 * 60 * 1000;

    if (isUpcoming && !isImminent) {
      log.push(`${raceLabel} — upcoming, skipping results.`);
      racesSkipped++;
      await setTimeout(DELAY_MS);
      continue;
    }

    if (isImminent) {
      log.push(`${raceLabel} — imminent (within 30h), fetching qualifying results...`);
      await setTimeout(DELAY_MS);
      const qualiResults = await fetchQualifying(season, round);
      if (qualiResults.length > 0) {
        await upsertQualifyingEntries(db, raceId, qualiResults);
        log.push(`  Stored ${qualiResults.length} qualifying entries.`);
      } else {
        log.push(`  No qualifying results yet.`);
      }

      // If it's a sprint weekend, also try to fetch sprint qualifying results
      if (race.Sprint) {
        await setTimeout(DELAY_MS);
        const sprintQualiResults = await fetchSprintQualifying(season, round);
        if (sprintQualiResults.length > 0) {
          await upsertSprintQualifyingEntries(db, raceId, sprintQualiResults);
          log.push(`  Stored ${sprintQualiResults.length} sprint qualifying entries.`);
        } else {
          log.push(`  No sprint qualifying results yet.`);
        }
      }

      racesSkipped++;
      await setTimeout(DELAY_MS);
      continue;
    }

    log.push(`${raceLabel} — fetching results...`);
    await setTimeout(DELAY_MS);
    const results = await fetchResults(season, round);

    if (results.length === 0) {
      log.push(`  No race results yet, checking for qualifying results...`);
      await setTimeout(DELAY_MS);
      const qualiResults = await fetchQualifying(season, round);
      if (qualiResults.length > 0) {
        await upsertQualifyingEntries(db, raceId, qualiResults);
        log.push(`  Stored ${qualiResults.length} qualifying entries.`);
      } else {
        log.push(`  No qualifying results yet either, skipping.`);
      }

      // If sprint weekend, also fetch sprint results and sprint qualifying
      if (race.Sprint) {
        await setTimeout(DELAY_MS);
        const sprintResults = await fetchSprintResults(season, round);
        if (sprintResults.length > 0) {
          await upsertSprintEntries(db, raceId, sprintResults);
          log.push(`  Stored ${sprintResults.length} sprint entries.`);
        }
        await setTimeout(DELAY_MS);
        const sprintQualiResults = await fetchSprintQualifying(season, round);
        if (sprintQualiResults.length > 0) {
          await upsertSprintQualifyingEntries(db, raceId, sprintQualiResults);
          log.push(`  Stored ${sprintQualiResults.length} sprint qualifying entries.`);
        }
      }

      racesSkipped++;
      continue;
    }

    await upsertRaceEntries(db, raceId, results);
    log.push(`  Stored ${results.length} entries.`);

    // If sprint weekend, also fetch and store sprint results and sprint qualifying
    if (race.Sprint) {
      await setTimeout(DELAY_MS);
      const sprintResults = await fetchSprintResults(season, round);
      if (sprintResults.length > 0) {
        await upsertSprintEntries(db, raceId, sprintResults);
        log.push(`  Stored ${sprintResults.length} sprint entries.`);
      } else {
        log.push(`  No sprint results available.`);
      }
      await setTimeout(DELAY_MS);
      const sprintQualiResults = await fetchSprintQualifying(season, round);
      if (sprintQualiResults.length > 0) {
        await upsertSprintQualifyingEntries(db, raceId, sprintQualiResults);
        log.push(`  Stored ${sprintQualiResults.length} sprint qualifying entries.`);
      }
    }

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
      log.push(`  No before standings available (round ${prevRound} — likely start of season).`);
    }

    // "after" standings: always fetch from API
    await setTimeout(DELAY_MS);
    const driverAfter = await fetchDriverStandings(season, round);
    await setTimeout(DELAY_MS);
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
