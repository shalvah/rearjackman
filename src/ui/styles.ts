export const css = `
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
    line-height: 2.0;
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
  .season-list .circuit { color: var(--muted); font-size: 0.8rem; min-width: 120px; }
  .season-list .upcoming { color: var(--accent); font-size: 0.75rem; font-weight: 600; }

  /* ---- Home ---- */
  .home-seasons { list-style: none; }
  .home-seasons li { margin: 4px 0; }
  .home-seasons a { font-size: 1.5rem; color: var(--text); }
  .home-seasons a:hover { color: var(--accent); text-decoration: none; }
  .home-seasons .current { color: var(--accent); font-weight: 700; }

  /* ---- Collapsible sections ---- */
  .collapsed-row { display: none; }
  .collapsed-card { display: none; }
  .show-more-btn {
    display: inline-block;
    margin-top: 10px;
    padding: 5px 14px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted);
    font-family: var(--font);
    font-size: 0.8rem;
    cursor: pointer;
    letter-spacing: 0.04em;
  }
  .show-more-btn:hover { border-color: var(--accent); color: var(--accent); }

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
`;
