import { GAME } from '../config/game.js';
import { slotsFor } from '../config/formations.js';
import { isCompatible } from '../rules/slots.js';

// Team Rating v2: rata-rata rating efektif 11 pemain (x faktor kecocokan) + coach bonus.
// Slot kosong dinilai 40.
export function effectiveRating(entity, slot) {
  if (!entity) return 40;
  const r = isCompatible(entity, slot ?? {});
  if (!r.ok) return entity.rating ?? 40;
  return (entity.rating ?? 40) * (r.factor ?? 1);
}

export function calcTeamRatingEntities(lineup, formation = GAME.formationDefault, coach = null, coachBonusEnabled = true) {
  const defs = slotsFor(formation).filter((s) => s.slotId !== 'COACH');
  let sum = 0;
  for (const def of defs) {
    const entry = lineup.find((l) => l.slotId === def.slotId);
    sum += entry?.entity ? effectiveRating(entry.entity, def) : 40;
  }
  let rating = sum / 11;
  if (coachBonusEnabled && coach) {
    rating += Math.max(0, (coach.rating - GAME.coachBonusBase)) * GAME.coachBonusFactor;
  }
  return Math.round(rating * 10) / 10;
}

// Kompatibel API lama: array pemain → rata-rata 11 terbaik.
export function calcTeamRating(squadPlayers) {
  const list = [...squadPlayers].sort((a, b) => b.rating - a.rating);
  if (list.length === 0) return 40;
  const gks = list.filter((p) => p.position === 'GK');
  const rest = list.filter((p) => p.position !== 'GK');
  const xi = [];
  if (gks.length > 0) xi.push(gks[0]);
  for (const p of rest) {
    if (xi.length >= 11) break;
    xi.push(p);
  }
  for (const p of list) {
    if (xi.length >= 11) break;
    if (!xi.includes(p)) xi.push(p);
  }
  let sum = xi.reduce((s, p) => s + p.rating, 0);
  sum += (11 - xi.length) * 40;
  return Math.round((sum / 11) * 10) / 10;
}

export function calcManagerScore({ teamRating, baselineRating, totalSpend, budgetLeft, initialBudget, penalties, modifierCount }) {
  const efficiencyBonus = totalSpend > 0 ? Math.max(0, Math.round(((teamRating - baselineRating) / totalSpend) * 100)) : 0;
  const budgetBonus = Math.max(0, Math.round((budgetLeft / Math.max(1, initialBudget)) * 50));
  const mult = GAME.difficultyMultiplier[modifierCount] ?? 1;
  const raw = teamRating * 10 + efficiencyBonus + budgetBonus - (penalties ?? 0) * 10;
  return Math.max(0, Math.round(raw * mult));
}

export function gradeFor(score) {
  for (const band of GAME.gradeBands) {
    if (score >= band.min) return band.grade;
  }
  return 'D';
}

export function rankManagers(rows, winnerCriteria = 'TEAM_RATING') {
  const sorted = [...rows].sort((a, b) => {
    const key = winnerCriteria === 'MANAGER_SCORE' ? 'score' : 'teamRating';
    if (b[key] !== a[key]) return b[key] - a[key];
    if (b.budget !== a.budget) return b.budget - a.budget;
    return b.score - a.score;
  });
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}
