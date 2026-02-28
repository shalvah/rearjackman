import type { Race, RaceEntry, StandingsSnapshot } from './types';

// ---- Shared layout ----

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Rear JackMan</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f0f0f;
      --surface: #1a1a1a;
      --border: #2e2e2e;
      --text: #e8e8e8;
      --muted: #888;
      --accent: #e10600; /* F1 red */
      --accent-dim: #7a0300;
      --green: #4caf50;
      --yellow: #ffc107;
      --font: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 14px;
      line-height: 1.6;
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px 64px;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 1.1rem; font-weight: 600; margin: 32px 0 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    h3 { font-size: 0.95rem; font-weight: 600; margin: 0 0 8px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }

    .breadcrumb { font-size: 0.8rem; color: var(--muted); margin-bottom: 20px; }
    .breadcrumb a { color: var(--muted); }
    .breadcrumb a:hover { color: var(--text); }

    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th {
      text-align: left;
      padding: 6px 10px;
      color: var(--muted);
      font-weight: 500;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface); }

    .tag {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .tag-dnf { background: #3b1010; color: #f87171; }
    .tag-fl  { background: #1a0d2e; color: #c084fc; }
    .tag-current { background: var(--accent); color: #fff; }

    .pos-delta { font-size: 0.75rem; margin-left: 4px; }
    .pos-up   { color: var(--green); }
    .pos-down { color: #f87171; }
    .pos-same { color: var(--muted); }

    .standings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 8px;
    }

    .standings-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
    }

    .race-header {
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--accent);
    }
    .race-header .meta { color: var(--muted); font-size: 0.85rem; margin-top: 6px; line-height: 1.8; }
    .race-header .round-badge {
      display: inline-block;
      background: var(--accent);
      color: #fff;
      padding: 2px 10px;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin-bottom: 8px;
    }

    /* ---- Grid & Results table (desktop) ---- */
    .results-table-wrap { overflow-x: auto; }
    .results-table-wrap table { min-width: 520px; }

    /* ---- Grid & Results cards (mobile) ---- */
    .results-cards { display: none; list-style: none; }
    .result-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 8px;
    }
    .result-card-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .result-card-pos {
      font-size: 1.2rem;
      font-weight: 700;
      min-width: 28px;
    }
    .result-card-driver { font-weight: 600; flex: 1; }
    .result-card-pts {
      font-size: 0.85rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .result-card-pts strong { color: var(--text); }
    .result-card-meta {
      font-size: 0.8rem;
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
    }
    .result-card-meta span { white-space: nowrap; }

    /* ---- Season list ---- */
    .season-list { list-style: none; }
    .season-list li { border-bottom: 1px solid var(--border); }
    .season-list li:last-child { border-bottom: none; }
    .season-list a {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 10px 4px;
      color: var(--text);
    }
    .season-list a:hover { background: var(--surface); text-decoration: none; }
    .season-list .round-num { color: var(--muted); font-size: 0.8rem; min-width: 24px; }
    .season-list .race-name { flex: 1; }
    .season-list .race-date { color: var(--muted); font-size: 0.8rem; white-space: nowrap; }
    .season-list .circuit { color: var(--muted); font-size: 0.8rem; min-width: 120px; text-align: right; }
    .season-list .upcoming { color: var(--accent); font-size: 0.75rem; font-weight: 600; }

    /* ---- Home ---- */
    .home-seasons { list-style: none; }
    .home-seasons li { margin: 4px 0; }
    .home-seasons a { font-size: 1.1rem; color: var(--text); }
    .home-seasons a:hover { color: var(--accent); text-decoration: none; }
    .home-seasons .current { color: var(--accent); font-weight: 700; }

    /* ---- Mobile ---- */
    @media (max-width: 600px) {
      body { padding: 16px 12px 48px; }
      h1 { font-size: 1.2rem; }
      h2 { margin: 24px 0 10px; }

      .standings-grid { grid-template-columns: 1fr; }

      /* swap table for cards in results */
      .results-table-wrap { display: none; }
      .results-cards { display: block; }

      /* hide circuit on season list to save space */
      .season-list .circuit { display: none; }
      .season-list .race-date { display: none; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// ---- Home page ----

export function renderHome(seasons: number[], latestSeason: number): string {
  const items = seasons
    .map((s) => {
      const isCurrent = s === latestSeason;
      return `<li>
        <a href="/${s}" class="${isCurrent ? 'current' : ''}">${s} Season${isCurrent ? ' <span class="tag tag-current">LIVE</span>' : ''}</a>
      </li>`;
    })
    .join('\n');

  const body = `
    <h1>Rear JackMan</h1>
    <p style="color:var(--muted);margin:8px 0 32px">F1 season tracker</p>
    <h2>Seasons</h2>
    <ul class="home-seasons">
      ${items}
    </ul>`;

  return layout('Home', body);
}

// ---- Season list page ----

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
        ${race.url ? `&middot; <a href="${race.url}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
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

  sorted.forEach((e) => {
    const isDnf = e.finish_position === null;
    const isFl = e.fastest_lap === 1;
    const gridPos = e.grid_position ?? '—';
    const finishPos = e.finish_position ?? '—';
    const gridNum = typeof gridPos === 'number' ? gridPos : null;
    const finishNum = typeof finishPos === 'number' ? finishPos : null;

    let posDelta = '';
    if (gridNum !== null && finishNum !== null) {
      const diff = gridNum - finishNum; // positive = moved up
      if (diff > 0) posDelta = `<span class="pos-delta pos-up">+${diff}</span>`;
      else if (diff < 0) posDelta = `<span class="pos-delta pos-down">${diff}</span>`;
      else posDelta = `<span class="pos-delta pos-same">=</span>`;
    }

    const pts = e.points > 0 ? e.points : '—';
    const driverDisplay = `${e.driver_code ? `<strong>${e.driver_code}</strong> ` : ''}${e.driver_name}`;
    const flTag = isFl ? ' <span class="tag tag-fl">FL</span>' : '';
    const statusDisplay = isDnf ? `<span class="tag tag-dnf">${escHtml(e.status)}</span>` : escHtml(e.status);

    tableRows.push(`<tr>
      <td>${finishPos}${posDelta}</td>
      <td>${driverDisplay}${flTag}</td>
      <td>${e.constructor}</td>
      <td>${gridPos}</td>
      <td>${statusDisplay}</td>
      <td style="text-align:right">${pts}</td>
    </tr>`);

    cards.push(`<li class="result-card">
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
    <ul class="results-cards">${cards.join('\n')}</ul>`;
}

function renderStandingsSection(
  race: Race,
  driversBefore: StandingsSnapshot[],
  constructorsBefore: StandingsSnapshot[],
  driversAfter: StandingsSnapshot[],
  constructorsAfter: StandingsSnapshot[]
): string {
  // Build lookup maps for "before" positions/points keyed by entity_id
  const driversBeforeMap = new Map(driversBefore.map((s) => [s.entity_id, s]));
  const constructorsBeforeMap = new Map(constructorsBefore.map((s) => [s.entity_id, s]));

  const driverRows = driversAfter.map((s) => {
    const before = driversBeforeMap.get(s.entity_id);
    return standingsRow(s, before);
  }).join('\n');

  const constructorRows = constructorsAfter.map((s) => {
    const before = constructorsBeforeMap.get(s.entity_id);
    return standingsRow(s, before);
  }).join('\n');

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
        <table>
          <thead><tr><th>Pos</th><th>Driver</th><th style="text-align:right">Pts</th><th style="text-align:right">Wins</th></tr></thead>
          <tbody>${driverRows}</tbody>
        </table>
      </div>
      <div class="standings-box">
        <h3>Constructors</h3>
        <table>
          <thead><tr><th>Pos</th><th>Constructor</th><th style="text-align:right">Pts</th><th style="text-align:right">Wins</th></tr></thead>
          <tbody>${constructorRows}</tbody>
        </table>
      </div>
    </div>`;
}

function standingsRow(after: StandingsSnapshot, before?: StandingsSnapshot): string {
  let posDelta = '';
  if (before) {
    const diff = before.position - after.position; // positive = moved up
    if (diff > 0) posDelta = `<span class="pos-delta pos-up">+${diff}</span>`;
    else if (diff < 0) posDelta = `<span class="pos-delta pos-down">${diff}</span>`;
    else posDelta = `<span class="pos-delta pos-same">=</span>`;
  }

  const ptsDiff = before ? after.points - before.points : null;
  const ptsLabel = ptsDiff !== null && ptsDiff > 0
    ? `${after.points} <span style="color:var(--green);font-size:0.75rem">+${ptsDiff}</span>`
    : `${after.points}`;

  return `<tr>
    <td>${after.position}${posDelta}</td>
    <td>${escHtml(after.entity_name)}</td>
    <td style="text-align:right">${ptsLabel}</td>
    <td style="text-align:right">${after.wins}</td>
  </tr>`;
}

// ---- Utilities ----

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD; format as "1 Mar 2025"
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[month - 1]} ${year}`;
}
