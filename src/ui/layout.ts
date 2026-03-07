import { css } from './styles';
import { collapseToggleScript } from './client';

// ---- Shared page shell ----

export function layout(title: string, body: string, activePath = '', breadcrumb = ''): string {
  const navLink = (href: string, label: string) =>
    `<a href="${href}"${activePath === href ? ' class="active"' : ''}>${label}</a>`;

  const nav = `<nav class="site-nav">
  <div class="site-nav-left">
    ${navLink('/', 'Home')}
    ${navLink('/news', 'News')}
  </div>
  ${breadcrumb ? `<div class="site-nav-right">${breadcrumb}</div>` : ''}
</nav>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${title} — Rear JackMan</title>
  <style>${css}</style>
</head>
<body>
${nav}
${body}
<script>${collapseToggleScript}</script>
</body>
</html>`;
}

// ---- Shared render helpers ----

export function posDeltaHtml(diff: number): string {
  if (diff > 0) return `<span class="pos-delta pos-up">+${diff}</span>`;
  if (diff < 0) return `<span class="pos-delta pos-down">${diff}</span>`;
  return `<span class="pos-delta pos-same">=</span>`;
}

export function showMoreBtn(total: number, preview: number): string {
  if (total <= preview) return '';
  return `<button class="show-more-btn" data-label-more="Show all ${total} &darr;" data-label-less="Show less &uarr;">Show all ${total} &darr;</button>`;
}

// ---- Utilities ----

export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD; format as "1 Mar 2025"
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[month - 1]} ${year}`;
}
