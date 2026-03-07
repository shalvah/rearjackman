import type { Race, RaceEntry, QualiEntry, StandingsSnapshot } from '../../types';

import { layout, escHtml, posDeltaHtml, showMoreBtn, formatDate } from '../layout';

const PREVIEW = 5;

// ---- Race detail page ----

export function renderRaceDetail(
  race: Race,
  entries: RaceEntry[],
  qualiEntries: QualiEntry[],
  driversBefore: StandingsSnapshot[],
  constructorsBefore: StandingsSnapshot[],
  driversAfter: StandingsSnapshot[],
  constructorsAfter: StandingsSnapshot[],
  otherSeasons: number[]
): string {
  const hasResults = entries.length > 0;
  const hasQuali = qualiEntries.length > 0;
  const hasStandings = driversAfter.length > 0;
  const hasotherRaces = otherSeasons.length > 0;

  const body = `
    <div class="race-header">
      <div class="round-badge">ROUND ${race.round} &middot; ${race.season}</div>
      <h1>${race.name}</h1>
      <div class="meta">
        ${race.circuit_name}${race.locality ? ` &middot; ${race.locality}, ${race.country}` : ''}
        &middot; <span id="race-date-local">${race.date}${race.time ? ' ' + race.time : ''}</span>
        ${race.wikipedia_url ? `&middot; <a href="${race.wikipedia_url}" target="_blank" rel="noopener">Wikipedia</a>` : ''}

    ${hasotherRaces ? ` &middot; Other seasons: ` + renderOtherRaces(otherSeasons, race.round) : ''}
      </div>
      ${renderExternalLinks(race)}
    </div>

    ${hasResults
      ? renderGridResults(entries, race.season, constructorsAfter)
      : hasQuali
        ? renderQualiResults(qualiEntries, race.season)
        : '<p style="color:var(--muted)">Results not yet available.</p>'
    }

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

  return layout(`${race.name} ${race.season}`, body, '', `<a href="/${race.season}">${race.season}</a> / Round ${race.round}`);
}

// ---- Qualifying Results section ----

// Parse a lap time string ("1:15.096" or "75.096") into milliseconds, or null if invalid
function parseLapTimeMs(t: string | null): number | null {
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs)) return null;
    return (mins * 60 + secs) * 1000;
  }
  const secs = parseFloat(parts[0]);
  return isNaN(secs) ? null : secs * 1000;
}

// Format a delta in ms as "+0.000s", always showing sign, null → ''
function fmtDelta(ms: number | null): string {
  if (ms === null) return '';
  const sign = ms >= 0 ? '+' : '−';
  return `<span style="color:var(--muted);font-size:0.72rem"> ${sign}${(Math.abs(ms) / 1000).toFixed(3)}s</span>`;
}

function renderQualiResults(entries: QualiEntry[], season: number): string {
  const tableRows: string[] = [];
  const cards: string[] = [];

  entries.forEach((e, i) => {
    const isHidden = i >= PREVIEW;
    const driverLink = `<a href="/driver/${e.jolpica_driver_id}?season=${season}">${e.driver_name}</a>`;
    const driverDisplay = `${e.driver_code ? `<strong>${e.driver_code}</strong> ` : ''}${driverLink}`;

    const q1 = e.q1 ?? '—';
    const q2 = e.q2 ?? '—';
    const q3 = e.q3 ?? '—';

    const prev = i > 0 ? entries[i - 1] : null;
    const calcDelta = (cur: string | null, prevTime: string | null): string => {
      const a = parseLapTimeMs(cur), b = parseLapTimeMs(prevTime);
      return fmtDelta(a !== null && b !== null ? a - b : null);
    };
    const q1Delta = calcDelta(e.q1, prev?.q1 ?? null);
    const q2Delta = calcDelta(e.q2, prev?.q2 ?? null);
    const q3Delta = calcDelta(e.q3, prev?.q3 ?? null);

    tableRows.push(`<tr${isHidden ? ' class="collapsed-row"' : ''}>
      <td>${e.position}</td>
      <td>${driverDisplay}</td>
      <td>${escHtml(e.constructor)}</td>
      <td>${q1}${q1Delta}</td>
      <td>${q2}${q2Delta}</td>
      <td>${q3}${q3Delta}</td>
    </tr>`);

    cards.push(`<li class="result-card${isHidden ? ' collapsed-card' : ''}">
      <div class="result-card-top">
        <span class="result-card-pos">${e.position}</span>
        <span class="result-card-driver">${driverDisplay}</span>
        <span class="result-card-pts">${q3 !== '—' ? q3 + q3Delta : q2 !== '—' ? q2 + q2Delta : q1 + q1Delta}</span>
      </div>
      <div class="result-card-meta">
        <span>${escHtml(e.constructor)}</span>
        <span>Q1: ${q1}${q1Delta}</span>
        ${e.q2 ? `<span>Q2: ${q2}${q2Delta}</span>` : ''}
        ${e.q3 ? `<span>Q3: ${q3}${q3Delta}</span>` : ''}
      </div>
    </li>`);
  });

  return `
    <h2>Qualifying</h2>
    <div class="collapsible-section" data-expanded="false">
      <div class="results-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Driver</th>
              <th>Constructor</th>
              <th>Q1</th>
              <th>Q2</th>
              <th>Q3</th>
            </tr>
          </thead>
          <tbody>${tableRows.join('\n')}</tbody>
        </table>
      </div>
      <ul class="results-cards">${cards.join('\n')}</ul>
      ${showMoreBtn(entries.length, PREVIEW)}
    </div>`;
}

// ---- Grid & Results section ----

function renderGridResults(entries: RaceEntry[], season: number, constructorStandings: StandingsSnapshot[]): string {
  // Create a map of constructor name -> constructor ID from standings
  // This is a best-effort mapping since we only have constructor name in entries
  const constructorIdMap = new Map(constructorStandings.map(c => [c.entity_name, c.entity_id]));

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
    const driverLink = `<a href="/driver/${e.jolpica_driver_id}?season=${season}">${e.driver_name}</a>`;
    const driverDisplay = `${e.driver_code ? `<strong>${e.driver_code}</strong> ` : ''}${driverLink}`;
    
    // Attempt to link constructor
    const constructorId = constructorIdMap.get(e.constructor);
    const constructorDisplay = constructorId 
      ? `<a href="/constructor/${constructorId}?season=${season}">${escHtml(e.constructor)}</a>`
      : escHtml(e.constructor);

    const flTag = isFl ? ' <span class="tag tag-fl">FL</span>' : '';
    const statusDisplay = isDnf
      ? `<span class="tag tag-dnf">${escHtml(e.status)}</span>`
      : escHtml(e.status);

    tableRows.push(`<tr${isHidden ? ' class="collapsed-row"' : ''}>
      <td>${finishPos}${posDelta}</td>
      <td>${driverDisplay}${flTag}</td>
      <td>${constructorDisplay}</td>
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
  const beforeLabel = prevRound === 0 ? 'Pre-season' : `after Round ${prevRound}`;

  return `
    <h2>Championship Standings</h2>
    <p style="color:var(--muted);font-size:0.8rem;margin-bottom:16px">
      Compared to ${beforeLabel}
    </p>

    <div class="standings-grid">
      <div class="standings-box">
        <h3>Drivers</h3>
        ${renderStandingsTable(driversAfter, driversBeforeMap, 'Driver', race.season)}
      </div>
      <div class="standings-box">
        <h3>Constructors</h3>
        ${renderStandingsTable(constructorsAfter, constructorsBeforeMap, 'Constructor', race.season)}
      </div>
    </div>`;
}

function renderStandingsTable(
  after: StandingsSnapshot[],
  beforeMap: Map<string, StandingsSnapshot>,
  entityLabel: string,
  season: number
): string {
  const rows = after.map((s, i) => {
    const before = beforeMap.get(s.entity_id);
    return standingsRow(s, before, i >= PREVIEW, entityLabel, season);
  }).join('\n');

  return `<div class="collapsible-section" data-expanded="false">
    <table>
      <thead><tr><th>Pos</th><th>${entityLabel}</th><th style="text-align:right">Pts</th><th style="text-align:right">Wins</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${showMoreBtn(after.length, PREVIEW)}
  </div>`;
}

function standingsRow(after: StandingsSnapshot, before: StandingsSnapshot | undefined, isHidden = false, entityLabel: string, season: number): string {
  const posDelta = before ? posDeltaHtml(before.position - after.position) : '';

  const ptsDiff = before ? after.points - before.points : null;
  const ptsLabel = ptsDiff !== null && ptsDiff > 0
    ? `${after.points} <span style="color:var(--green);font-size:0.75rem">+${ptsDiff}</span>`
    : `${after.points}`;

  let nameDisplay = escHtml(after.entity_name);
  if (entityLabel === 'Driver') {
    nameDisplay = `<a href="/driver/${after.entity_id}?season=${season}">${escHtml(after.entity_name)}</a>`;
  } else if (entityLabel === 'Constructor') {
    nameDisplay = `<a href="/constructor/${after.entity_id}?season=${season}">${escHtml(after.entity_name)}</a>`;
  }

  return `<tr${isHidden ? ' class="collapsed-row"' : ''}>
    <td>${after.position}${posDelta}</td>
    <td>${nameDisplay}</td>
    <td style="text-align:right">${ptsLabel}</td>
    <td style="text-align:right">${after.wins}</td>
  </tr>`;
}

function renderOtherRaces(seasons: number[], round: number): string {
  return seasons.map((season) => {
    return `<a href="/${season}/${round}">${season}</a>`;
  }).join(' &middot; \n');
}

// ---- External links section ----

// "Australian Grand Prix" → "AustralianGP"
// "São Paulo Grand Prix" → "SãoPauloGP"
// "Abu Dhabi Grand Prix" → "AbuDhabiGP"
function toGpHashtag(raceName: string): string {
  return raceName
    .replace(/\s+Grand Prix$/i, '')  // strip trailing "Grand Prix"
    .replace(/\s+/g, '')             // collapse all spaces
    + 'GP';
}

type ExternalLink = { label: string; url: string; description: string };

function buildExternalLinks(race: Race): ExternalLink[] {
  const hashtag = toGpHashtag(race.name);
  return [
    {
      label: '@f1visualized',
      url: `https://nitter.net/search?f=tweets&q=${encodeURIComponent(`from:f1visualized "#${hashtag}" ${race.season}`) }`,
      description: 'Session visualizations',
    },
    {
      label: '@the_lollipopman',
      url: `https://nitter.net/search?f=tweets&q=${encodeURIComponent(`from:the_lollipopman "#${hashtag}" ${race.season}`) }`,
      description: 'Fun takes',
    },
  ];
}

function renderExternalLinks(race: Race): string {
  const links = buildExternalLinks(race);
  const items = links.map(link =>
    `<a href="${link.url}" target="_blank" rel="noopener">${escHtml(link.label)}</a>`
  ).join(' &middot; ');

  return `<div class="meta ext-links-meta">More: ${items}</div>`;
}
