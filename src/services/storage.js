import { GAME } from '../config/game.js';

export function saveSession(state) {  try {
    const { _past, ...persisted } = state;
    const payload = { ...persisted, updatedAt: Date.now() };
    localStorage.setItem(GAME.storageKey, JSON.stringify(payload));
    try {
      const bc = new BroadcastChannel(GAME.broadcastChannel);
      bc.postMessage({ type: 'STATE', state: payload });
      bc.close();
    } catch { /* BroadcastChannel opsional */ }
    return true;
  } catch {
    return false;
  }
}

export function loadSession() {
  try {
    // Migrasi lunak: coba v2 dulu, lalu v1 (diabaikan, tawarkan game baru).
    const raw = localStorage.getItem(GAME.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.schemaVersion === GAME.schemaVersion) {
        if (!parsed.sessionId || !parsed.config || !Array.isArray(parsed.managers)) return null;
        return { migrated: true, state: parsed };
      }
      return { migrated: false, state: null };
    }
    const legacy = localStorage.getItem('fm-challenge:session:v1');
    if (legacy) return { migrated: false, state: null, hasLegacy: true };
    return null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(GAME.storageKey);
  } catch {
    // abaikan: storage nonaktif tetap bisa main tanpa autosave
  }
}
