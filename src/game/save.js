const KEY = 'abyss-diver-save-v1';

export function loadSave() {
  const def = { unlocked: 1, best: {}, sound: true, music: true, total: 0, controls: 'stick', view: 'normal', minimap: true, vibrate: true, diver: 'bubble' };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s ? { ...def, ...s, best: s.best || {} } : def;
  } catch { return def; }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}
