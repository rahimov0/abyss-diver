// Copies the playable web game into www/ for the iOS app (Capacitor webDir).
// The web version on GitHub Pages is served straight from the repo root, so nothing is bundled here.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'www';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'privacy.html', 'terms.html', 'support.html']) {
  if (existsSync(f)) cpSync(f, `${OUT}/${f}`);
}
cpSync('src', `${OUT}/src`, { recursive: true });

// The app needs Capacitor's JS runtime (registerPlugin) next to the native bridge; the website doesn't.
cpSync('node_modules/@capacitor/core/dist/capacitor.js', `${OUT}/capacitor.js`);
const html = readFileSync(`${OUT}/index.html`, 'utf8');
if (!html.includes('<script type="module"')) throw new Error('index.html: module script not found');
writeFileSync(`${OUT}/index.html`, html.replace('<script type="module"', '<script src="capacitor.js"></script>\n  <script type="module"'));
console.log('www ready');
