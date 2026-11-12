const KEY = 'abyss-diver-save-v1';

// Called after every local save (the cloud sync registers here).
export const saveHooks = [];

export function loadSave() {
  const def = { unlocked: 1, best: {}, sound: true, music: true, total: 0, controls: 'stick', view: 'normal', minimap: true, vibrate: true, diver: 'bubble', buttons: 'normal' };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s ? { ...def, ...s, best: s.best || {} } : def;
  } catch { return def; }
}

export function writeSave(s, { silent = false } = {}) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  if (!silent) for (const h of saveHooks) h(s);
}

// Combine two progress records: never lose a level, a star or a high score.
export function mergeProgress(local, remote) {
  if (!remote) return false;
  let changed = false;
  if ((remote.unlocked || 1) > local.unlocked) { local.unlocked = remote.unlocked; changed = true; }
  for (const [id, r] of Object.entries(remote.best || {})) {
    const l = local.best[id] || { score: 0, stars: 0 };
    const m = { score: Math.max(l.score || 0, r.score || 0), stars: Math.max(l.stars || 0, r.stars || 0) };
    if (!local.best[id] || m.score !== l.score || m.stars !== l.stars) { local.best[id] = m; changed = true; }
  }
  if (remote.diver && remote.diver !== 'bubble' && local.diver === 'bubble') { local.diver = remote.diver; changed = true; }
  return changed;
}

// Only progress goes to the cloud; sound / controls / view stay per device.
export function progressOf(s) {
  return { unlocked: s.unlocked, best: s.best, diver: s.diver };
}
