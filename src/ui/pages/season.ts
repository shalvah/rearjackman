import type { Race } from '../../types';
import { layout, formatDate } from '../layout';

export function renderSeasonList(season: number, races: Race[]): string {
  const today = new Date().toISOString().slice(0, 10);

  const rows = races
    .map((race) => {
      // Race is upcoming if its date is more than two days in the future (so we can show quali)
      const isUpcoming = new Date(race.date) > new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000);
      const dateStr = formatDate(race.date);
      return `<li>
        <a href="/${season}/${race.round}">
          <span class="round-num">${race.round}</span>
          <span class="race-name">${race.name} ${isUpcoming ? '<span class="upcoming">UPCOMING</span>' : ''}</span>
          <span class="race-date">${dateStr}</span> <span class="circuit">&middot; ${race.circuit_name}</span>
        </a>
      </li>`;
    })
    .join('\n');

  const body = `
    <h1>${season} Season</h1>
    <ul class="season-list" style="margin-top:24px">
      ${rows}
    </ul>`;

  return layout(`${season} Season`, body);
}
