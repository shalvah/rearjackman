import type { Race, RaceEntry } from '../../types';
import { layout, escHtml, posDeltaHtml } from '../layout';

export function renderDriverPage(
  driverId: string,
  driverName: string,
  season: number,
  currentResults: (RaceEntry & { race: Race })[],
  previousResults: (RaceEntry & { race: Race })[]
): string {
  const title = `${driverName} - ${season} Driver Profile`;
  
  const body = `
    <div class="driver-header">
      <h1>${escHtml(driverName)}</h1>
      <div class="meta">
        Season ${season} Summary
      </div>
    </div>

    <div class="driver-content">
      <section>
        <h2>${season} Season Results</h2>
        ${renderSeasonTable(currentResults)}
      </section>

      ${previousResults.length > 0 ? `
      <section style="margin-top: 2rem;">
        <h2>${season - 1} Season Results</h2>
        ${renderSeasonTable(previousResults)}
      </section>
      ` : ''}
    </div>
  `;

  return layout(title, body, '', `<a href="/${season}">${season}</a> / Drivers / ${escHtml(driverName)}`);
}

function renderSeasonTable(results: (RaceEntry & { race: Race })[]): string {
  if (results.length === 0) {
    return '<p style="color:var(--muted)">No results available.</p>';
  }

  // Ensure results are sorted by round
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
    
    // Calculate positions gained/lost
    const gridNum = typeof entry.grid_position === 'number' ? entry.grid_position : null;
    const finishNum = typeof entry.finish_position === 'number' ? entry.finish_position : null;
    const posDelta = gridNum !== null && finishNum !== null
      ? posDeltaHtml(gridNum - finishNum)
      : '';

    // Table Row
    tableRows.push(`
      <tr>
        <td><a href="/${race.season}/${race.round}">R${race.round} &middot; ${escHtml(race.name)}</a></td>
        <td>${escHtml(entry.constructor)}</td>
        <td>${gridPos}</td>
        <td>${finishPos}${posDelta}</td>
        <td>${status}</td>
        <td style="text-align:right">${pts}</td>
      </tr>
    `);

    // Mobile Card
    cards.push(`<li class="result-card">
      <div class="result-card-top">
        <span class="result-card-pos">${finishPos}${posDelta}</span>
        <span class="result-card-driver"><a href="/${race.season}/${race.round}">R${race.round} &middot; ${escHtml(race.name)}</a></span>
        <span class="result-card-pts"><strong>${pts}</strong> pts</span>
      </div>
      <div class="result-card-meta">
        <span>${escHtml(entry.constructor)}</span>
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
        <tbody>
          ${tableRows.join('\n')}
        </tbody>
      </table>
    </div>
    <ul class="results-cards">
      ${cards.join('\n')}
    </ul>
  `;
}
