import { layout } from '../layout';

export function renderHome(seasons: number[], latestSeason: number, ogTitle = ''): string {
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
    <p style="color:var(--muted);margin:8px 0 32px">F1 season tracker for busy people</p>
    <h2>Seasons</h2>
    <ul class="home-seasons">
      ${items}
    </ul>`;

  return layout('Home', body, '/', '', ogTitle);
}
