import { syncSeason } from './sync';
import type { Env, Race } from './types';
import { route } from './router';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return route(request, env, ctx);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = Date.now();
    const season = new Date().getFullYear();
    console.log(`[cron] Fired for ${season} season`);

    ctx.waitUntil((async () => {
      try {
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

      } catch (err) {
        console.error(`[cron] Error:`, err);
      }
    })());
  },

  async queue(batch: MessageBatch<{ season: number; fromRound?: number; toRound?: number }>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { season, fromRound, toRound } = message.body;
      console.log(`[queue] Starting sync for ${season} (from round ${fromRound ?? 1}, to round ${toRound ?? 'end'})`);
      try {
        const result = await syncSeason(season, env.DB, fromRound ?? 1, toRound);
        console.log(`[queue] Sync complete for ${season}:`, JSON.stringify(result));
        message.ack();
      } catch (err) {
        console.error(`[queue] Sync failed for ${season}:`, err);
        message.retry();
      }
    }
  },
};
