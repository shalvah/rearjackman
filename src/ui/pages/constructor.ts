import type { Race, RaceEntry } from '../../types';
import { layout, escHtml, posDeltaHtml } from '../layout';

export function renderConstructorPage(
  constructorId: string,
  constructorName: string,
  season: number,
  currentResults: (RaceEntry & { race: Race })[],
  previousResults: (RaceEntry & { race: Race })[]
): string {
  const title = `${constructorName} - ${season} Constructor Profile`;
  
  const body = `
    <div class="driver-header">
      <h1>${escHtml(constructorName)}</h1>
      <div class="meta">
        Season ${season} Summary
      </div>
    </div>

    <div class="driver-content">
      <section>
        <h2>${season} Season Results</h2>
        ${renderSeasonTable(currentResults, season)}
      </section>

      ${previousResults.length > 0 ? `
      <section style="margin-top: 2rem;">
        <h2>${season - 1} Season Results</h2>
        ${renderSeasonTable(previousResults, season - 1)}
      </section>
      ` : ''}
    </div>
  `;

  return layout(title, body, '', `<a href="/${season}">${season}</a> / Constructors / ${escHtml(constructorName)}`);
}

function renderSeasonTable(results: (RaceEntry & { race: Race })[], season: number): string {
  if (results.length === 0) {
    return '<p style="color:var(--muted)">No results available.</p>';
  }

  // Sort by round, then by finish position
  const sorted = [...results].sort((a, b) => {
    if (a.race.round !== b.race.round) {
      return a.race.round - b.race.round;
    }
    // For same race, sort by finish position (or grid if DNF)
    if (a.finish_position !== null && b.finish_position !== null) {
      return a.finish_position - b.finish_position;
    }
    if (a.finish_position !== null) return -1;
    if (b.finish_position !== null) return 1;
    return (a.grid_position ?? 99) - (b.grid_position ?? 99);
  });

  const tableRows: string[] = [];
  const cards: string[] = [];

  sorted.forEach((entry, i) => {
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

    const driverLink = `<a href="/driver/${entry.jolpica_driver_id}?season=${season}">${escHtml(entry.driver_name)}</a>`;

    // Check if next entry is same race (to remove bottom border)
    const nextEntry = sorted[i + 1];
    const isNextSameRace = nextEntry && nextEntry.race.id === race.id;
    
    // Check if previous entry is same race (to hide race name)
    const prevEntry = sorted[i - 1];
    const isPrevSameRace = prevEntry && prevEntry.race.id === race.id;

    // Use specific inline style to override CSS
    const cellStyle = isNextSameRace ? 'border-bottom:none' : '';
    const alignRight = 'text-align:right';
    
    const styleAttr = (style: string) => style ? ` style="${style}"` : '';

    const rightAlignStyle = cellStyle 
      ? ` style="${cellStyle};${alignRight}"` 
      : ` style="${alignRight}"`;
      
    // If previous was same race, hide race info
    const raceDisplay = isPrevSameRace 
      ? '' 
      : `<a href="/${race.season}/${race.round}">R${race.round} &middot; ${escHtml(race.name)}</a>`;

    // Table Row
    tableRows.push(`
      <tr>
        <td${styleAttr(cellStyle)}>${raceDisplay}</td>
        <td${styleAttr(cellStyle)}>${driverLink}</td>
        <td${styleAttr(cellStyle)}>${gridPos}</td>
        <td${styleAttr(cellStyle)}>${finishPos}${posDelta}</td>
        <td${styleAttr(cellStyle)}>${status}</td>
        <td${rightAlignStyle}>${pts}</td>
      </tr>
    `);

    // Mobile Card
    cards.push(`<li class="result-card">
      <div class="result-card-top">
        <span class="result-card-pos">${finishPos}${posDelta}</span>
        <span class="result-card-driver">${driverLink}</span>
        <span class="result-card-pts"><strong>${pts}</strong> pts</span>
      </div>
      <div class="result-card-meta">
        <span><a href="/${race.season}/${race.round}">R${race.round} &middot; ${escHtml(race.name)}</a></span>
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
            <th>Driver</th>
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
