import { createContext, useContext, useMemo } from 'react';
import { usePersistedReducer } from '../hooks/usePersistedReducer.js';
import { useDataset } from '../hooks/useDataset.js';
import { useGameManager } from '../hooks/useGameManager.js';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { state, dispatch } = usePersistedReducer();
  const dataset = useDataset();
  const manager = useGameManager(dataset, state, dispatch);
  const value = useMemo(() => ({ ...manager, dataset, dispatch }), [manager, dataset, dispatch]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame harus di dalam GameProvider');
  return ctx;
}
