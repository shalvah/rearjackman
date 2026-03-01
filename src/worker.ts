import { FAVICON_SVG } from './assets';
import type { Env, Race, RaceEntry, StandingsSnapshot } from './types';
import { syncSeason } from './sync';
import { renderHome, renderSeasonList, renderRaceDetail, renderDriverPage, renderConstructorPage } from './ui/render';

const CURRENT_YEAR = 2026; // Hardcoded because `new Date()` returns 1970 in Cloudflare Workers' global scope.
const KNOWN_SEASONS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => CURRENT_YEAR - i);
const LATEST_SEASON = KNOWN_SEASONS[0];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico') {
      return new Response(FAVICON_SVG, {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }

    const segments = url.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

    try {
      // GET / — home page: list of seasons
      if (segments.length === 0) {
        return htmlResponse(renderHome(KNOWN_SEASONS, LATEST_SEASON));
      }

      // GET /api/sync/:season — trigger sync
      if (segments[0] === 'api' && segments[1] === 'sync' && segments[2]) {
        return handleSync(request, env, ctx, segments[2]);
      }

      // GET /driver/:driverId — driver profile
      if (segments[0] === 'driver' && segments[1]) {
        const driverId = segments[1];
        const seasonParam = url.searchParams.get('season');
        const season = seasonParam ? parseInt(seasonParam) : LATEST_SEASON;
        return handleDriverPage(env, driverId, season);
      }

      // GET /constructor/:constructorId — constructor profile
      if (segments[0] === 'constructor' && segments[1]) {
        const constructorId = segments[1];
        const seasonParam = url.searchParams.get('season');
        const season = seasonParam ? parseInt(seasonParam) : LATEST_SEASON;
        return handleConstructorPage(env, constructorId, season);
      }

      // GET /:season — season list
      if (segments.length === 1 && /^\d{4}$/.test(segments[0])) {
        const season = parseInt(segments[0]);
        return handleSeasonList(env, season);
      }

      // GET /:season/:round — race detail
      if (segments.length === 2 && /^\d{4}$/.test(segments[0]) && /^\d+$/.test(segments[1])) {
        const season = parseInt(segments[0]);
        const round = parseInt(segments[1]);
        return handleRaceDetail(env, season, round);
      }

      return notFound();
    } catch (err) {
      console.error(err);
      return errorResponse(err instanceof Error ? err.message : 'Unknown error');
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Sync the current season — runs on cron schedule defined in wrangler.toml
    const season = new Date().getFullYear();
    console.log(`[cron] Starting sync for ${season} season`);
    ctx.waitUntil(
      syncSeason(season, env.DB)
        .then((result) => console.log(`[cron] Sync complete:`, JSON.stringify(result)))
        .catch((err) => console.error(`[cron] Sync failed:`, err))
    );
  },

  async queue(batch: MessageBatch<{ season: number; fromRound?: number }>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { season, fromRound } = message.body;
      console.log(`[queue] Starting sync for ${season} (from round ${fromRound ?? 1})`);
      try {
        const result = await syncSeason(season, env.DB, fromRound ?? 1);
        console.log(`[queue] Sync complete for ${season}:`, JSON.stringify(result));
        message.ack();
      } catch (err) {
        console.error(`[queue] Sync failed for ${season}:`, err);
        message.retry();
      }
    }
  },
};

// ---- Route handlers ----

async function handleSync(request: Request, env: Env, ctx: ExecutionContext, seasonStr: string): Promise<Response> {
  const secret = request.headers.get('X-Sync-Secret');
  if (!secret || secret !== env.SYNC_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const season = parseInt(seasonStr);
  if (isNaN(season) || season < 1950 || season > 2100) {
    return new Response('Invalid season', { status: 400 });
  }

  const url = new URL(request.url);
  const fromRound = parseInt(url.searchParams.get('from') || '1');

  await env.SYNC_QUEUE.send({ season, fromRound });
  console.log(`[manual-sync] Queued sync for ${season} (from round ${fromRound})`);

  return new Response(JSON.stringify({ message: `Sync queued for season ${season} starting from round ${fromRound}` }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSeasonList(env: Env, season: number): Promise<Response> {
  const races = await env.DB.prepare(
    'SELECT * FROM races WHERE season = ? ORDER BY round ASC'
  )
    .bind(season)
    .all<Race>();

  if (races.results.length === 0) {
    return notFound(`No data for the ${season} season. You may need to run a sync first.`);
  }

  return htmlResponse(renderSeasonList(season, races.results));
}

async function handleRaceDetail(env: Env, season: number, round: number): Promise<Response> {
  const race = await env.DB.prepare(
    'SELECT * FROM races WHERE season = ? AND round = ?'
  )
    .bind(season, round)
    .first<Race>();

  if (!race) {
    return notFound(`Race not found: ${season} round ${round}.`);
  }

  const [entries, snapshotsBefore, snapshotsAfter] = await Promise.all([
    env.DB.prepare('SELECT * FROM race_entries WHERE race_id = ? ORDER BY COALESCE(finish_position, 99), grid_position')
      .bind(race.id)
      .all<RaceEntry>(),
    env.DB.prepare(
      "SELECT * FROM standings_snapshots WHERE race_id = ? AND snapshot_type = 'before' ORDER BY entity_type, position"
    )
      .bind(race.id)
      .all<StandingsSnapshot>(),
    env.DB.prepare(
      "SELECT * FROM standings_snapshots WHERE race_id = ? AND snapshot_type = 'after' ORDER BY entity_type, position"
    )
      .bind(race.id)
      .all<StandingsSnapshot>(),
  ]);

  const otherSeasons = KNOWN_SEASONS.filter((s) => s !== season);

  const driversBefore = snapshotsBefore.results.filter((s) => s.entity_type === 'driver');
  const constructorsBefore = snapshotsBefore.results.filter((s) => s.entity_type === 'constructor');
  const driversAfter = snapshotsAfter.results.filter((s) => s.entity_type === 'driver');
  const constructorsAfter = snapshotsAfter.results.filter((s) => s.entity_type === 'constructor');

  return htmlResponse(
    renderRaceDetail(
      race,
      entries.results,
      driversBefore,
      constructorsBefore,
      driversAfter,
      constructorsAfter,
      otherSeasons
    )
  );
}

async function handleDriverPage(env: Env, driverId: string, season: number): Promise<Response> {
  // Fetch results for the requested season
  const currentResults = await env.DB.prepare(`
    SELECT re.*, r.season, r.round, r.name as race_name, r.date, r.circuit_name 
    FROM race_entries re
    JOIN races r ON re.race_id = r.id
    WHERE re.jolpica_driver_id = ? AND r.season = ?
    ORDER BY r.round ASC
  `)
  .bind(driverId, season)
  .all<any>();

  // Fetch results for the previous season
  const previousResults = await env.DB.prepare(`
    SELECT re.*, r.season, r.round, r.name as race_name, r.date, r.circuit_name 
    FROM race_entries re
    JOIN races r ON re.race_id = r.id
    WHERE re.jolpica_driver_id = ? AND r.season = ?
    ORDER BY r.round ASC
  `)
  .bind(driverId, season - 1)
  .all<any>();

  // Determine driver name from results or fallback
  let driverName = driverId;
  if (currentResults.results.length > 0) {
    driverName = currentResults.results[0].driver_name;
  } else if (previousResults.results.length > 0) {
    driverName = previousResults.results[0].driver_name;
  } else {
    // If no results found in either season, try to find the driver name from *any* race entry
    const anyEntry = await env.DB.prepare('SELECT driver_name FROM race_entries WHERE jolpica_driver_id = ? LIMIT 1')
      .bind(driverId)
      .first<{ driver_name: string }>();
    
    if (anyEntry) {
      driverName = anyEntry.driver_name;
    } else {
        return notFound(`Driver not found: ${driverId}`);
    }
  }

  // Transform flat results into nested structure required by renderDriverPage
  const mapResults = (rows: any[]) => {
    return rows.map(row => ({
      ...row,
      race: {
        id: row.race_id,
        season: row.season,
        round: row.round,
        name: row.race_name,
        circuit_name: row.circuit_name,
        date: row.date,
        // ... other race fields if needed
      }
    }));
  };

  const currentMapped = mapResults(currentResults.results);
  const previousMapped = mapResults(previousResults.results);

  return htmlResponse(
    renderDriverPage(
      driverId,
      driverName,
      season,
      currentMapped as any,
      previousMapped as any
    )
  );
}

async function handleConstructorPage(env: Env, constructorId: string, season: number): Promise<Response> {
  // First, find the constructor name using the standings_snapshots table (most reliable source for ID->Name mapping)
  const snapshot = await env.DB.prepare(
    "SELECT entity_name FROM standings_snapshots WHERE entity_id = ? AND entity_type = 'constructor' LIMIT 1"
  )
    .bind(constructorId)
    .first<{ entity_name: string }>();

  let constructorName = snapshot?.entity_name;

  // If not found in snapshots (e.g. no points yet), try to guess from ID (fallback) or return 404
  if (!constructorName) {
      // Fallback: This might fail if the constructor has no points ever.
      // But usually active constructors have some entry in standings even with 0 points if the sync is correct.
      // If not, we can't reliably filter race_entries because race_entries only has the name.
      // Let's try to query race_entries with a LIKE? No, that's risky.
      // If we can't find the name, we probably can't find entries.
      return notFound(`Constructor not found: ${constructorId}`);
  }

  // Fetch results for the requested season
  const currentResults = await env.DB.prepare(`
    SELECT re.*, r.season, r.round, r.name as race_name, r.date, r.circuit_name 
    FROM race_entries re
    JOIN races r ON re.race_id = r.id
    WHERE re.constructor = ? AND r.season = ?
    ORDER BY r.round ASC, re.finish_position ASC
  `)
  .bind(constructorName, season)
  .all<any>();

  // Fetch results for the previous season
  const previousResults = await env.DB.prepare(`
    SELECT re.*, r.season, r.round, r.name as race_name, r.date, r.circuit_name 
    FROM race_entries re
    JOIN races r ON re.race_id = r.id
    WHERE re.constructor = ? AND r.season = ?
    ORDER BY r.round ASC, re.finish_position ASC
  `)
  .bind(constructorName, season - 1)
  .all<any>();

  // Transform flat results into nested structure
  const mapResults = (rows: any[]) => {
    return rows.map(row => ({
      ...row,
      race: {
        id: row.race_id,
        season: row.season,
        round: row.round,
        name: row.race_name,
        circuit_name: row.circuit_name,
        date: row.date,
      }
    }));
  };

  const currentMapped = mapResults(currentResults.results);
  const previousMapped = mapResults(previousResults.results);

  return htmlResponse(
    renderConstructorPage(
      constructorId,
      constructorName,
      season,
      currentMapped as any,
      previousMapped as any
    )
  );
}

// ---- Helpers ----

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function notFound(message = 'Not found'): Response {
  return new Response(message, { status: 404 });
}

function errorResponse(message: string): Response {
  return new Response(`Internal error: ${message}`, { status: 500 });
}
