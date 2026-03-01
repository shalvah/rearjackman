import type { Env, Race, RaceEntry, StandingsSnapshot } from './types';
import { syncSeason } from './sync';
import { renderHome, renderSeasonList, renderRaceDetail } from './ui/render';

// Seasons shown on the home page — dynamically starts from the current year
const CURRENT_YEAR = 2026;
const KNOWN_SEASONS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => CURRENT_YEAR - i);
const LATEST_SEASON = KNOWN_SEASONS[0];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

    try {
      // GET / — home page: list of seasons
      if (segments.length === 0) {
        return htmlResponse(renderHome(KNOWN_SEASONS, LATEST_SEASON));
      }

      // GET /api/sync/:season — trigger sync
      if (segments[0] === 'api' && segments[1] === 'sync' && segments[2]) {
        return handleSync(request, env, segments[2]);
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
};

// ---- Route handlers ----

async function handleSync(request: Request, env: Env, seasonStr: string): Promise<Response> {
  const secret = request.headers.get('X-Sync-Secret');
  if (!secret || secret !== env.SYNC_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const season = parseInt(seasonStr);
  if (isNaN(season) || season < 1950 || season > 2100) {
    return new Response('Invalid season', { status: 400 });
  }

  const result = await syncSeason(season, env.DB);
  return new Response(JSON.stringify(result, null, 2), {
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

  const driversBefore = snapshotsBefore.results.filter((s) => s.entity_type === 'driver');
  const constructorsBefore = snapshotsBefore.results.filter((s) => s.entity_type === 'constructor');
  const driversAfter = snapshotsAfter.results.filter((s) => s.entity_type === 'driver');
  const constructorsAfter = snapshotsAfter.results.filter((s) => s.entity_type === 'constructor');

  return htmlResponse(
    renderRaceDetail(race, entries.results, driversBefore, constructorsBefore, driversAfter, constructorsAfter)
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
