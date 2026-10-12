import { useEffect } from 'react';
import { GAME } from '../config/game.js';

// Sinkron satu arah moderator -> display via BroadcastChannel.
export function useBroadcast(state) {
  useEffect(() => {
    // Disimpan oleh storage.saveSession; hook ini hanya untuk display view.
  }, [state]);
}

export function useDisplaySync(onState) {
  useEffect(() => {
    let bc = null;
    try {
      bc = new BroadcastChannel(GAME.broadcastChannel);
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'STATE' && ev.data.state) onState(ev.data.state);
      };
    } catch { /* abaikan */ }
    return () => {
      try { bc?.close(); } catch { /* abaikan */ }
    };
  }, [onState]);
}
