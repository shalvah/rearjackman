import * as Sentry from '@sentry/cloudflare';
import { syncSeason } from './sync';
import type { Env, Race } from './types';
import { route } from './router';

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    sendDefaultPii: true,
  }),
  {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      return route(request, env, ctx);
    },

    // The scheduled sync runs every 20 minutes on Thursday to Monday (potential race weekend).
    // It syncs results for the latest race, exiting if we're not in a race weekend.
    // Note: To determine "race weekend", it checks the database,
    // so it relies on an initial manual sync to populate the db with the schedule.
    async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
      const now = Date.now();
      const season = new Date().getFullYear();
      console.log(`[cron] Fired for ${season} season`);

      ctx.waitUntil((async () => {
        await Sentry.withMonitor(
          'rearjackman-sync-cron',
          async () => {
            // Check D1 for a race whose weekend window overlaps now, before making any API calls.
            // Window: 3 days before race datetime (Thu practice) through 12 hours after (results settle).
            const WINDOW_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;
            const WINDOW_AFTER_MS  = 12 * 60 * 60 * 1000;

            const races = await env.DB.prepare(
              'SELECT * FROM races WHERE season = ? ORDER BY round ASC'
            ).bind(season).all<Race>();

            const currentRace = races.results.find((r) => {
              const raceMs = r.time
                ? new Date(`${r.date}T${r.time}`).getTime()
                : new Date(`${r.date}T14:00:00Z`).getTime(); // fallback: assume 14:00 UTC
              return now >= raceMs - WINDOW_BEFORE_MS && now <= raceMs + WINDOW_AFTER_MS;
            });

            if (!currentRace) {
              console.log(`[cron] Not a race weekend, exiting.`);
              return;
            }

            console.log(`[cron] Race weekend: Round ${currentRace.round} (${currentRace.name}). Queuing sync.`);
            await env.SYNC_QUEUE.send({
              season,
              fromRound: currentRace.round,
              toRound: currentRace.round,
            });
          },
          {
            schedule: {
              type: 'crontab',
              // Cron fires every 20 min Thu–Mon; use a representative schedule.
              // Sentry monitors don't support day-of-week unions in a single crontab expression,
              // so we monitor at the per-20-min cadence (Sentry will alert on missed runs).
              value: '*/20 * * * *',
            },
            checkinMargin: 5,   // minutes of grace before a run is considered missed
            maxRuntime: 10,     // minutes before a run is considered failed
            timezone: 'UTC',
          },
        );
      })());
    },

    async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
      for (const message of batch.messages) {
        const { season, fromRound, toRound } = message.body as { season: number; fromRound?: number; toRound?: number };
        console.log(`[queue] Starting sync for ${season} (from round ${fromRound ?? 1}, to round ${toRound ?? 'end'})`);
        try {
          const result = await syncSeason(season, env.DB, fromRound ?? 1, toRound);
          console.log(`[queue] Sync complete for ${season}:`, JSON.stringify(result));
          message.ack();
        } catch (err) {
          console.error(`[queue] Sync failed for ${season}:`, err);
          Sentry.captureException(err);
          message.retry();
        }
      }
    },
  },
);
