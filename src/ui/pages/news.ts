import type { Feed } from '../../news';
import { layout, escHtml, showMoreBtn } from '../layout';

const PREVIEW = 3;

export function renderNewsPage(feeds: Feed[]): string {
  const sections = feeds.map((feed) => {
    let content: string;

    if (feed.error || feed.items.length === 0) {
      content = `<p style="color:var(--muted);font-size:0.85rem">${feed.error ? `Could not load feed: ${escHtml(feed.error)}` : 'No items found.'}</p>`;
    } else {
      const rows = feed.items.map((item, i) => {
        const isHidden = i >= PREVIEW;
        return `<li class="news-item${isHidden ? ' news-item-hidden' : ''}">
          <a href="${escHtml(item.link)}" target="_blank" rel="noopener">${escHtml(item.title)}</a>${item.pubDate ? `<span class="news-item-date">${escHtml(item.pubDate)}</span>` : ''}
        </li>`;
      }).join('\n');

      content = `<ul class="news-list">${rows}</ul>
      ${showMoreBtn(feed.items.length, PREVIEW)}`;
    }

    return `<div class="news-source collapsible-section" data-expanded="false">
      <h2>${escHtml(feed.name)}</h2>
      ${content}
    </div>`;
  }).join('\n');

  const body = `
    <h1>Latest F1 News</h1>

    ${sections}`;

  return layout('F1 News', body, '/news');
}
