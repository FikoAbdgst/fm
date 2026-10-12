import { round1 } from './slots.js';

// Harga dasar per manager (sellFactor tidak berlaku di sini; murni harga kandidat).
export function priceFor(entity) {
  if (!entity) return 0;
  return round1(entity.price ?? 0);
}

function fail(message) {
  return { ok: false, ruleId: 'SANG_MANTAN', message, overridable: true };
}

// Validasi ranking 1-2-3 kandidat (v3: wajib sebelum pick).
// slotCandidateIds = 3 kandidat resmi slot itu.
export function validateRanking(slotCandidateIds, ranking) {
  if (!ranking || ranking.length !== 3) return fail('Urutkan 3 kandidat (peringkat 1-2-3) sebelum pick.');
  if (new Set(ranking).size !== 3) return fail('Ranking duplikat.');
  const set = new Set(slotCandidateIds);
  for (const id of ranking) {
    if (!set.has(id)) return fail('Ranking harus dari 3 kandidat slot ini.');
  }
  return { ok: true };
}

// Rantai fallback: peringkat tertinggi yang terjangkau dan lolos menu.
// canTake(id) disediakan pemanggil (cek budget + menu).
export function resolveRankedPick(ranking, canTake) {
  for (const id of ranking) {
    if (canTake(id)) return { type: 'PICK', candidateId: id };
  }
  return { type: 'NONE' };
}
