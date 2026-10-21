import { query, queryAll } from "./dom";
import { catalogState } from './catalog-state';

const dialog = query<HTMLDialogElement>(document, '#site-menu')!;
const triggers = [...queryAll<HTMLButtonElement>(document, '[data-open-menu]')];
const input = query<HTMLInputElement>(document, '#piece-search')!;
const results = query<HTMLElement>(document, '#menu-results')!;
const browse = query<HTMLElement>(document, '#menu-browse')!;
const status = query<HTMLElement>(document, '#menu-result-status')!;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let trigger: HTMLButtonElement | undefined;
let closing: ReturnType<typeof setTimeout> | undefined;
let request = 0;

function close() {
  if (!dialog.open || closing) return;
  const finish = () => {
    dialog.close();
    dialog.classList.remove('is-closing');
    document.body.classList.remove('has-dialog');
    triggers.forEach(button => button.setAttribute('aria-expanded', 'false'));
    (trigger?.getClientRects().length ? trigger : triggers.find(button => button.getClientRects().length))?.focus();
    closing = undefined;
  };
  if (reduce.matches) finish();
  else { dialog.classList.add('is-closing'); closing = setTimeout(finish, 180); }
}
triggers.forEach(button => button.addEventListener('click', () => {
  if (closing) { clearTimeout(closing); closing = undefined; dialog.classList.remove('is-closing'); }
  trigger = button;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('has-dialog');
  triggers.forEach(item => item.setAttribute('aria-expanded', 'true'));
}));
query(dialog, '[data-close-menu]')?.addEventListener('click', close);
dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
dialog.addEventListener('click', event => { if (event.target === dialog && (event as MouseEvent).clientX < dialog.getBoundingClientRect().left) close(); });
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const nodes = [...queryAll<HTMLElement>(dialog, 'a[href],button,input')].filter(el => el.getClientRects().length);
  const first = nodes[0], last = nodes.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
input.addEventListener('input', async () => {
  const current = ++request, term = input.value.trim().toLowerCase();
  results.hidden = !term; browse.hidden = Boolean(term);
  if (!term) { status.textContent = ''; return; }
  status.textContent = 'Finding pieces…';
  const state = await catalogState();
  if (current !== request) return;
  let count = 0;
  queryAll<HTMLAnchorElement>(results, '[data-menu-piece]').forEach(link => {
    link.hidden = state.retired.includes(link.dataset.menuPiece ?? '') || !term.split(/\s+/).every(word => link.dataset.query?.includes(word));
    if (!link.hidden) { count++; const image = query(link, 'img')!; image.src = image.dataset.src!; }
  });
  status.textContent = count ? `${count} ${count === 1 ? 'piece' : 'pieces'} found` : 'No pieces found. Try a garment, color or design name.';
});
query(document, '.menu-search')?.addEventListener('submit', event => { if (!input.value.trim()) event.preventDefault(); });
