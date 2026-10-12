import { getAllowedDraftActions } from '../rules/moodSwing.js';

export function currentTurn(state) {
  return state.turns[state.currentTurnIndex] ?? null;
}

// Riwayat KEEP/SELL manager dari turn yang sudah REVEALED (sumber Mood Swing).
export function historyForManager(state, managerId) {
  return state.turns
    .filter((t) => t.status === 'REVEALED' && (t.decisions?.[managerId] === 'KEEP' || t.decisions?.[managerId] === 'SELL'))
    .map((t) => ({ type: t.decisions[managerId], slotId: t.slotId }));
}

export function selectAllowedDraftActionsFor(state, managerId) {
  if (state.config.mode !== 'HARD' || !state.config.modifiers.includes('MOOD_SWING')) return ['KEEP', 'SELL'];
  return getAllowedDraftActions(historyForManager(state, managerId));
}

export function selectStreakFor(state, managerId) {
  const d = historyForManager(state, managerId);
  if (!d.length) return null;
  let n = 1;
  for (let i = d.length - 1; i > 0; i--) {
    if (d[i].type === d[i - 1].type) n++;
    else break;
  }
  return { type: d[d.length - 1].type, count: n };
}

// Bisa reveal bila semua manager (yang tidak absen) sudah input.
export function selectCanReveal(state) {
  const turn = currentTurn(state);
  if (!turn || turn.status !== 'SEALED') return false;
  return state.managers
    .filter((m) => !(turn.absent ?? []).includes(m.id))
    .every((m) => turn.decisions?.[m.id]);
}

export function pendingPicks(state) {
  const turn = currentTurn(state);
  if (!turn || turn.status !== 'REVEALED') return [];
  return state.managers.filter((m) =>
    turn.decisions?.[m.id] === 'SELL' && !turn.picks?.[m.id] && !(turn.absent ?? []).includes(m.id),
  );
}

export function selectCanFinishDraft(state) {
  if (!state.turns.length) return false;
  return state.turns.every((t) => t.status === 'REVEALED');
}

export function selectTurnProgress(state) {
  const done = state.turns.filter((t) => t.status === 'REVEALED').length;
  return { done, total: state.turns.length };
}
