import { GAME } from '../config/game.js';

export function blankState() {
  return {
    schemaVersion: GAME.schemaVersion,
    sessionId: '',
    seed: 0,
    phase: 'SETUP',
    config: {
      clubId: '',
      managerCount: 2,
      mode: 'CASUAL',
      modifiers: [],
      formation: GAME.formationDefault,
      initialBudget: GAME.budgetDefault,
      budgetOverrides: {},
      decisionMode: 'SIMULTANEOUS',
      infoMode: 'OPEN',
      sellFactor: GAME.sellFactor,
      sellFactorEnabled: GAME.sellFactorEnabled,
    },
    compose: { slots: {}, coach: null, locked: false },
    customEntities: {},
    managers: [],
    turns: [],
    currentTurnIndex: 0,
    eventLog: [],
    eventSeq: 0,
    overrides: [],
    createdAt: 0,
    updatedAt: 0,
    _past: [],
  };
}
