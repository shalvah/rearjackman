import { layout } from '../layout';

export function renderHome(seasons: number[], latestSeason: number, seasonRaces: { name: string, date: string, round: number }[]): string {
  let latestRaceText = '';
  let ogDescription = '';
  if (seasonRaces.length > 0) {
    const today = new Date().toISOString().slice(0, 10);

    // Check if we're in a race weekend (Fri–Sun: race_date - 2 days through race_date)
    const ongoingRace = seasonRaces.find((r) => {
      const raceDate = r.date;
      const fridayDate = new Date(new Date(raceDate).getTime() - 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return today >= fridayDate && today <= raceDate;
    });
  
    if (ongoingRace) {
      ogDescription = `Ongoing: ${ongoingRace.name}`;
      latestRaceText = `Ongoing: <a href="/${latestSeason}/${ongoingRace.round}">${ongoingRace.name}</a>`;
    } else {
      // Find the next upcoming race (first race with date > today)
      const nextRace = seasonRaces.find((r) => r.date > today);
      if (nextRace) {
        ogDescription = `Up Next: ${nextRace.name}`;
        latestRaceText = `Up Next: <a href="/${latestSeason}/${nextRace.round}">${nextRace.name}</a> on ${nextRace.date}`;
      }
    }
  } 
  

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
    <p style="color:var(--muted);margin-bottom:32px;font-size:1.1em">${latestRaceText}</p>
    <h2>Seasons</h2>
    <ul class="home-seasons">
      ${items}
    </ul>`;

  return layout('Home', body, '/', '', ogDescription);
}
