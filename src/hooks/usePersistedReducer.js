import { useEffect, useReducer, useRef } from 'react';
import { gameReducer } from '../state/gameReducer.js';
import { blankState } from '../state/initialState.js';
import { ACTIONS } from '../state/actions.js';
import { loadSession, saveSession } from '../services/storage.js';

// useReducer yang tersinkron ke localStorage (debounce 300ms, tahan quota/disabled).
export function usePersistedReducer() {
  const [state, dispatch] = useReducer(gameReducer, undefined, blankState);
  const hydrated = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    const found = loadSession();
    if (found?.state) {
      dispatch({ type: ACTIONS.STATE_HYDRATED, payload: { state: found.state } });
      hydrated.current = 'restorable';
    } else {
      hydrated.current = 'fresh';
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (state.phase === 'SETUP' && !state.sessionId) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveSession(state), 300);
    return () => clearTimeout(timer.current);
  }, [state]);

  return { state, dispatch, hydrated };
}
