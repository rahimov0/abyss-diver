import { defineConfig } from 'vite';
import { copyFileSync } from 'node:fs';

// The repo root is directly playable (GitHub Pages "deploy from branch").
// Vite is only used for local dev and optional bundling.
const STATIC = ['manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png'];

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [{
    name: 'copy-static',
    closeBundle() { for (const f of STATIC) copyFileSync(f, `dist/${f}`); },
  }],
});
