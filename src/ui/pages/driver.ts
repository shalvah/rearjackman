import type { Race, RaceEntry } from '../../types';
import { layout, escHtml, posDeltaHtml } from '../helpers';

export function renderDriverPage(
  driverId: string,
  driverName: string,
  activeSeason: number,
  seasons: number[],
  bySeason: Map<number, (RaceEntry & { race: Race; constructor_id: string | null })[]>
): string {
  const title = `${driverName} - Driver Profile`;

  const sections = seasons.map(season => {
    const results = bySeason.get(season) ?? [];
    const isActive = season === activeSeason;
    return `
      <details class="season-details"${isActive ? ' open' : ''}>
        <summary class="season-summary">${season} Season Results</summary>
        ${renderSeasonTable(results)}
      </details>`;
  }).join('\n');

  const body = `
    <div class="driver-header">
      <h1>${escHtml(driverName)}</h1>
      <div class="meta">Season Summary</div>
    </div>
    <div class="driver-content">
      ${sections}
    </div>
  `;

  return layout(title, body);
}

function renderSeasonTable(results: (RaceEntry & { race: Race; constructor_id: string | null })[]): string {
  if (results.length === 0) {
    return '<p style="color:var(--muted)">No results available.</p>';
  }

  const sorted = [...results].sort((a, b) => a.race.round - b.race.round);

  const tableRows: string[] = [];
  const cards: string[] = [];

  sorted.forEach(entry => {
    const race = entry.race;
    const finishPos = entry.finish_position ?? '—';
    const gridPos = entry.grid_position ?? '—';
    const pts = entry.points > 0 ? entry.points : '—';
    const status = entry.finish_position === null
      ? `<span class="tag tag-dnf">${escHtml(entry.status)}</span>`
      : escHtml(entry.status);

    const gridNum = typeof entry.grid_position === 'number' ? entry.grid_position : null;
    const finishNum = typeof entry.finish_position === 'number' ? entry.finish_position : null;
    const posDelta = gridNum !== null && finishNum !== null
      ? posDeltaHtml(gridNum - finishNum)
      : '';

    const constructorDisplay = entry.constructor_id
      ? `<a href="/constructor/${entry.constructor_id}?season=${race.season}">${escHtml(entry.constructor)}</a>`
      : escHtml(entry.constructor);

    tableRows.push(`
      <tr>
        <td><a href="/${race.season}/${race.round}">R${race.round} &middot; ${escHtml(race.name)}</a></td>
        <td>${constructorDisplay}</td>
        <td>${gridPos}</td>
        <td>${finishPos}${posDelta}</td>
        <td>${status}</td>
        <td style="text-align:right">${pts}</td>
      </tr>`);

    cards.push(`<li class="result-card">
      <div class="result-card-top">
        <span class="result-card-pos">${finishPos}${posDelta}</span>
        <span class="result-card-driver"><a href="/${race.season}/${race.round}">R${race.round} &middot; ${escHtml(race.name)}</a></span>
        <span class="result-card-pts"><strong>${pts}</strong> pts</span>
      </div>
      <div class="result-card-meta">
        <span>${constructorDisplay}</span>
        <span>Grid: ${gridPos}</span>
        <span>${status}</span>
      </div>
    </li>`);
  });

  return `
    <div class="results-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Race</th>
            <th>Constructor</th>
            <th>Grid</th>
            <th>Finish</th>
            <th>Status</th>
            <th style="text-align:right">Pts</th>
          </tr>
        </thead>
        <tbody>${tableRows.join('\n')}</tbody>
      </table>
    </div>
    <ul class="results-cards">${cards.join('\n')}</ul>
  `;
}
