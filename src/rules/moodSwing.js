import { GAME } from '../config/game.js';

export function validateMoodSwing(history, nextAction, streakLimit = GAME.moodSwingStreak) {
  const decisions = history.filter((a) => a.type === 'KEEP' || a.type === 'SELL');
  const needed = streakLimit - 1;
  if (decisions.length < needed) return { ok: true };
  const lastN = decisions.slice(-needed);
  const allSame = lastN.every((a) => a.type === nextAction.type);
  if (allSame) {
    return {
      ok: false,
      ruleId: 'MOOD_SWING',
      overridable: true,
      message: `Mood Swing: tidak boleh ${nextAction.type === 'KEEP' ? 'Pertahankan' : 'Jual'} ${streakLimit}x beruntun. Pilih aksi lawannya dulu.`,
    };
  }
  return { ok: true };
}

export function getAllowedDraftActions(history, streakLimit = GAME.moodSwingStreak) {
  return ['KEEP', 'SELL'].filter((t) => validateMoodSwing(history, { type: t }, streakLimit).ok);
}
