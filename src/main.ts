import data from '../games.json';
import { parseGames, playUrl } from './logic/games';

// Placeholder rendering (P1.1). The arcade design arrives in P1.2.
// Cards are built with DOM APIs and textContent only, never HTML strings.
const list = document.getElementById('games');
if (!list) throw new Error('#games element missing');

for (const game of parseGames(data)) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = playUrl(game);
  link.textContent = game.title;
  const summary = document.createElement('p');
  summary.textContent = game.summary;
  item.append(link, summary);
  list.append(item);
}
