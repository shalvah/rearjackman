import { syncSeason } from './sync';
import type { Env, JolpicaRace } from './types';
import { fetchSchedule } from './lib/jolpica';
import { route } from './router';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return route(request, env, ctx);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const season = new Date().getFullYear();
    const today = new Date().toISOString().slice(0, 10);
    console.log(`[cron] Checking schedule for ${season} season`);

    ctx.waitUntil((async () => {
      try {
        const races = await fetchSchedule(season);
        
        const completedRaces = races.filter((r: JolpicaRace) => r.date <= today);
        
        if (completedRaces.length === 0) {
          console.log(`[cron] No races completed yet for ${season}. Skipping sync.`);
          return;
        }

        const lastRace = completedRaces[completedRaces.length - 1];
        const lastRound = parseInt(lastRace.round);

        console.log(`[cron] Last completed race: Round ${lastRound} (${lastRace.raceName}) on ${lastRace.date}`);
        console.log(`[cron] Queuing sync for ${season} (Round ${lastRound} only)`);

        await env.SYNC_QUEUE.send({ 
          season, 
          fromRound: lastRound, 
          toRound: lastRound 
        });

      } catch (err) {
        console.error(`[cron] Failed to schedule sync:`, err);
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
