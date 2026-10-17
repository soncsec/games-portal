import data from '../games.json';
import './style.css';
import { parseGames, playUrl, type GameEntry } from './logic/games';

// Cards are built with DOM APIs and textContent only, never HTML strings.
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(game: GameEntry): HTMLLIElement {
  const live = game.status === 'live';
  const item = el('li', live ? 'card' : 'card card--soon');

  // A live card is one big link; a coming-soon card is not clickable.
  const body = live ? el('a', 'card-body') : el('div', 'card-body');
  if (body instanceof HTMLAnchorElement) body.href = playUrl(game);

  const frame = el('div', 'card-frame');
  const img = el('img', 'card-image');
  img.src = `./${game.image}`;
  img.alt = `${game.title} screenshot`;
  img.width = 256;
  img.height = 192;
  img.loading = 'lazy';
  frame.append(img);
  if (!live) frame.append(el('span', 'card-badge', 'Coming soon'));

  const tags = el('ul', 'card-tags');
  tags.setAttribute('aria-label', 'Tags');
  for (const t of game.tags) tags.append(el('li', 'card-tag', t));

  body.append(
    frame,
    el('h2', 'card-title', game.title),
    el('p', 'card-summary', game.summary),
    tags,
    el('span', 'card-play', live ? 'Play ▶' : 'Soon'),
  );
  item.append(body);
  return item;
}

const list = document.getElementById('games');
if (!list) throw new Error('#games element missing');
list.append(...parseGames(data).map(card));
