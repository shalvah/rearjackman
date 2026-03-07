import { layout } from '../layout';

const FEEDS: { name: string; url: string }[] = [
  { name: 'Autosport',      url: 'https://www.autosport.com/rss/f1/news' },
  { name: 'The Race',       url: 'https://the-race.com/feed/' },
  { name: 'BBC Sport F1',   url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml' },
  { name: 'Motorsport.com', url: 'https://www.motorsport.com/rss/f1/news' },
];

const PREVIEW = 3;
const TOTAL   = 10;

export function renderNewsPage(): string {
  const sections = FEEDS.map(({ name, url }) => {
    const src = `https://rss.bloople.net/?url=${encodeURIComponent(url)}&limit=${TOTAL}&showtitle=false&type=js`;
    const containerId = `feed-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    return `
    <div class="news-source">
      <h2>${name}</h2>
      <div class="news-feed" id="${containerId}">
        <p class="news-loading" style="color:var(--muted);font-size:0.85rem">Loading...</p>
      </div>
      <script src="${src}" data-feed-container="${containerId}" data-feed-preview="${PREVIEW}"></script>
    </div>`;
  }).join('\n');

  const body = `
    <div class="breadcrumb">
      <a href="/">Home</a> / News
    </div>

    <h1>Latest F1 News</h1>

    ${sections}

    <script>
      // After each bloople script injects its HTML into the document, move it into
      // the correct container and apply the preview collapse.
      document.querySelectorAll('script[data-feed-container]').forEach(function(scriptEl) {
        var containerId = scriptEl.getAttribute('data-feed-container');
        var preview = parseInt(scriptEl.getAttribute('data-feed-preview') || '3', 10);
        var container = document.getElementById(containerId);
        if (!container) return;

        // Bloople writes directly to the document; we intercept by watching for
        // newly inserted siblings and moving them into the container.
        var observer = new MutationObserver(function() {
          // Move any feed items that landed as siblings of the script into the container
          var parent = scriptEl.parentNode;
          var next = scriptEl.nextSibling;
          while (next && next !== scriptEl) {
            var toMove = next;
            next = next.nextSibling;
            if (toMove.nodeType === 1 /* ELEMENT_NODE */) {
              container.appendChild(toMove);
            }
          }
          applyPreview(container, preview);
        });
        observer.observe(scriptEl.parentNode, { childList: true });
      });

      function applyPreview(container, preview) {
        var items = container.querySelectorAll('.feed-item');
        if (items.length === 0) return;

        // Remove loading placeholder
        var loading = container.querySelector('.news-loading');
        if (loading) loading.remove();

        items.forEach(function(item, i) {
          if (i >= preview) item.classList.add('news-item-hidden');
        });

        var total = items.length;
        if (total > preview && !container.querySelector('.show-more-btn')) {
          var btn = document.createElement('button');
          btn.className = 'show-more-btn';
          btn.setAttribute('data-label-more', 'Show all ' + total + ' \u2193');
          btn.setAttribute('data-label-less', 'Show less \u2191');
          btn.textContent = 'Show all ' + total + ' \u2193';
          btn.addEventListener('click', function() {
            var hidden = container.querySelectorAll('.news-item-hidden');
            var expanded = hidden.length === 0;
            if (expanded) {
              items.forEach(function(item, i) {
                if (i >= preview) item.classList.add('news-item-hidden');
              });
              btn.textContent = btn.getAttribute('data-label-more');
            } else {
              hidden.forEach(function(item) { item.classList.remove('news-item-hidden'); });
              btn.textContent = btn.getAttribute('data-label-less');
            }
          });
          container.appendChild(btn);
        }
      }
    </script>`;

  return layout('F1 News', body, '/news');
}
