import { validateMoodSwing } from './moodSwing.js';
import { validateTransferMenu } from './transferMenu.js';

// Pipeline validasi umum v3 (PRD 3.3): KEEP/SELL lintas turn, PICK dari 3 kandidat.
export function validateDraftAction({ config, history, nextAction }) {
  const mods = config.modifiers ?? [];
  if (config.mode === 'HARD' && mods.includes('MOOD_SWING')) {
    const r = validateMoodSwing(history, nextAction);
    if (!r.ok) return r;
  }
  return { ok: true };
}

export function validatePickAction({ config, tree, menuCtx, menuNodeId, candidate, budgetAfterCredit }) {
  if (budgetAfterCredit < candidate.price - 1e-9) {
    return { ok: false, ruleId: 'BUDGET', message: 'Budget tidak cukup untuk kandidat ini.', overridable: false };
  }
  const mods = config.modifiers ?? [];
  if (config.mode === 'HARD' && mods.includes('TRANSFER_MENU') && tree && menuCtx) {
    const r = validateTransferMenu(tree, menuCtx, { menuNodeId }, candidate);
    if (!r.ok) return r;
  }
  return { ok: true };
}
