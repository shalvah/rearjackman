import type { Race } from '../../types';
import { layout, formatDate } from '../layout';

export function renderSeasonList(season: number, races: Race[]): string {
  const today = new Date().toISOString().slice(0, 10);

  const rows = races
    .map((race) => {
      const isUpcoming = race.date > today;
      const dateStr = formatDate(race.date);
      return `<li>
        <a href="/${season}/${race.round}">
          <span class="round-num">${race.round}</span>
          <span class="race-name">${race.name}</span>
          <span class="race-date">${dateStr}</span>
          <span class="circuit">${isUpcoming ? '<span class="upcoming">UPCOMING</span>' : race.circuit_name}</span>
        </a>
      </li>`;
    })
    .join('\n');

  const body = `
    <div class="breadcrumb"><a href="/">Home</a> / ${season}</div>
    <h1>${season} Season</h1>
    <ul class="season-list" style="margin-top:24px">
      ${rows}
    </ul>`;

  return layout(`${season} Season`, body);
}
