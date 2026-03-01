import type { Race, RaceEntry, StandingsSnapshot } from '../../types';
import { layout, escHtml, posDeltaHtml, showMoreBtn } from '../layout';

const PREVIEW = 5;

// ---- Race detail page ----

export function renderRaceDetail(
  race: Race,
  entries: RaceEntry[],
  driversBefore: StandingsSnapshot[],
  constructorsBefore: StandingsSnapshot[],
  driversAfter: StandingsSnapshot[],
  constructorsAfter: StandingsSnapshot[]
): string {
  const hasResults = entries.length > 0;
  const hasStandings = driversAfter.length > 0;

  const body = `
    <div class="breadcrumb">
      <a href="/">Home</a> /
      <a href="/${race.season}">${race.season}</a> /
      Round ${race.round}
    </div>

    <div class="race-header">
      <div class="round-badge">ROUND ${race.round} &middot; ${race.season}</div>
      <h1>${race.name}</h1>
      <div class="meta">
        ${race.circuit_name}${race.locality ? ` &middot; ${race.locality}, ${race.country}` : ''}
        &middot; <span id="race-date-local">${race.date}${race.time ? ' ' + race.time : ''}</span>
        ${race.wikipedia_url ? `&middot; <a href="${race.wikipedia_url}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
      </div>
    </div>

    ${hasResults ? renderGridResults(entries) : '<p style="color:var(--muted)">Results not yet available.</p>'}

    ${hasStandings ? renderStandingsSection(race, driversBefore, constructorsBefore, driversAfter, constructorsAfter) : ''}

    <script>
      // Convert race date/time to local timezone
      const el = document.getElementById('race-date-local');
      if (el) {
        const raw = '${race.date}${race.time ? 'T' + race.time : ''}';
        try {
          const d = new Date(raw);
          if (!isNaN(d.getTime())) {
            el.textContent = d.toLocaleString(undefined, {
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
            });
          }
        } catch(e) {}
      }
    </script>`;

  return layout(`${race.name} ${race.season}`, body);
}

// ---- Grid & Results section ----

function renderGridResults(entries: RaceEntry[]): string {
  // Sort: finishers by finish_position, then DNFs by grid_position
  const sorted = [...entries].sort((a, b) => {
    if (a.finish_position !== null && b.finish_position !== null) {
      return a.finish_position - b.finish_position;
    }
    if (a.finish_position !== null) return -1;
    if (b.finish_position !== null) return 1;
    return (a.grid_position ?? 99) - (b.grid_position ?? 99);
  });

  const tableRows: string[] = [];
  const cards: string[] = [];

  sorted.forEach((e, i) => {
    const isHidden = i >= PREVIEW;
    const isDnf = e.finish_position === null;
    const isFl = e.fastest_lap === 1;
    const gridPos = e.grid_position ?? '—';
    const finishPos = e.finish_position ?? '—';
    const gridNum = typeof gridPos === 'number' ? gridPos : null;
    const finishNum = typeof finishPos === 'number' ? finishPos : null;

    const posDelta = gridNum !== null && finishNum !== null
      ? posDeltaHtml(gridNum - finishNum)
      : '';

    const pts = e.points > 0 ? e.points : '—';
    const driverDisplay = `${e.driver_code ? `<strong>${e.driver_code}</strong> ` : ''}${e.driver_name}`;
    const flTag = isFl ? ' <span class="tag tag-fl">FL</span>' : '';
    const statusDisplay = isDnf
      ? `<span class="tag tag-dnf">${escHtml(e.status)}</span>`
      : escHtml(e.status);

    tableRows.push(`<tr${isHidden ? ' class="collapsed-row"' : ''}>
      <td>${finishPos}${posDelta}</td>
      <td>${driverDisplay}${flTag}</td>
      <td>${e.constructor}</td>
      <td>${gridPos}</td>
      <td>${statusDisplay}</td>
      <td style="text-align:right">${pts}</td>
    </tr>`);

    cards.push(`<li class="result-card${isHidden ? ' collapsed-card' : ''}">
      <div class="result-card-top">
        <span class="result-card-pos">${finishPos}${posDelta}</span>
        <span class="result-card-driver">${driverDisplay}${flTag}</span>
        <span class="result-card-pts"><strong>${pts}</strong> pts</span>
      </div>
      <div class="result-card-meta">
        <span>${escHtml(e.constructor)}</span>
        <span>Grid: ${gridPos}</span>
        <span>${statusDisplay}</span>
      </div>
    </li>`);
  });

  return `
    <h2>Grid &amp; Results</h2>
    <div class="collapsible-section" data-expanded="false">
      <div class="results-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Finish</th>
              <th>Driver</th>
              <th>Constructor</th>
              <th>Grid</th>
              <th>Status</th>
              <th style="text-align:right">Pts</th>
            </tr>
          </thead>
          <tbody>${tableRows.join('\n')}</tbody>
        </table>
      </div>
      <ul class="results-cards">${cards.join('\n')}</ul>
      ${showMoreBtn(sorted.length, PREVIEW)}
    </div>`;
}

// ---- Championship standings section ----

function renderStandingsSection(
  race: Race,
  driversBefore: StandingsSnapshot[],
  constructorsBefore: StandingsSnapshot[],
  driversAfter: StandingsSnapshot[],
  constructorsAfter: StandingsSnapshot[]
): string {
  const driversBeforeMap = new Map(driversBefore.map((s) => [s.entity_id, s]));
  const constructorsBeforeMap = new Map(constructorsBefore.map((s) => [s.entity_id, s]));

  const prevRound = race.round - 1;
  const beforeLabel = prevRound === 0 ? 'Pre-season' : `After Round ${prevRound}`;

  return `
    <h2>Championship Standings</h2>
    <p style="color:var(--muted);font-size:0.8rem;margin-bottom:16px">
      Deltas vs. ${beforeLabel}
    </p>

    <div class="standings-grid">
      <div class="standings-box">
        <h3>Drivers</h3>
        ${renderStandingsTable(driversAfter, driversBeforeMap, 'Driver')}
      </div>
      <div class="standings-box">
        <h3>Constructors</h3>
        ${renderStandingsTable(constructorsAfter, constructorsBeforeMap, 'Constructor')}
      </div>
    </div>`;
}

function renderStandingsTable(
  after: StandingsSnapshot[],
  beforeMap: Map<string, StandingsSnapshot>,
  entityLabel: string
): string {
  const rows = after.map((s, i) => {
    const before = beforeMap.get(s.entity_id);
    return standingsRow(s, before, i >= PREVIEW);
  }).join('\n');

  return `<div class="collapsible-section" data-expanded="false">
    <table>
      <thead><tr><th>Pos</th><th>${entityLabel}</th><th style="text-align:right">Pts</th><th style="text-align:right">Wins</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${showMoreBtn(after.length, PREVIEW)}
  </div>`;
}

function standingsRow(after: StandingsSnapshot, before: StandingsSnapshot | undefined, isHidden = false): string {
  const posDelta = before ? posDeltaHtml(before.position - after.position) : '';

  const ptsDiff = before ? after.points - before.points : null;
  const ptsLabel = ptsDiff !== null && ptsDiff > 0
    ? `${after.points} <span style="color:var(--green);font-size:0.75rem">+${ptsDiff}</span>`
    : `${after.points}`;

  return `<tr${isHidden ? ' class="collapsed-row"' : ''}>
    <td>${after.position}${posDelta}</td>
    <td>${escHtml(after.entity_name)}</td>
    <td style="text-align:right">${ptsLabel}</td>
    <td style="text-align:right">${after.wins}</td>
  </tr>`;
}
