// Copies the playable web game into www/ for the iOS app (Capacitor webDir).
// The web version on GitHub Pages is served straight from the repo root, so nothing is bundled here.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';

const OUT = 'www';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'privacy.html', 'terms.html', 'support.html']) {
  if (existsSync(f)) cpSync(f, `${OUT}/${f}`);
}
cpSync('src', `${OUT}/src`, { recursive: true });
console.log('www ready');
