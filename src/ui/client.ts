// Shared collapse toggle — used by all .show-more-btn buttons on every page.
export const collapseToggleScript = `
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.show-more-btn');
    if (!btn) return;
    var section = btn.closest('.collapsible-section');
    if (!section) return;
    var expanded = section.dataset.expanded === 'true';
    section.dataset.expanded = expanded ? 'false' : 'true';
    var hidden = section.querySelectorAll('.collapsed-row, .collapsed-card');
    hidden.forEach(function(el) { el.style.display = expanded ? '' : (el.classList.contains('result-card') ? 'block' : 'table-row'); });
    btn.textContent = expanded ? btn.dataset.labelMore : btn.dataset.labelLess;
  });
`;
