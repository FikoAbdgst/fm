// Lelang rebutan (v3.1): kandidat yang diklaim ≥2 manager dalam satu turn
// dilelang. Pemegang harga awal = pengklaim pertama. Kenaikan minimal
// €1M dari tawaran berjalan. Tanpa timer: moderator SOLD.
export const BID_STEP = 1;

export const round1 = (n) => Math.round(Number(n) * 10) / 10;

export function minNextBid(currentBid) {
  return round1(currentBid + BID_STEP);
}

function fail(message, ruleId = 'BID') {
  return { ok: false, ruleId, message, overridable: false };
}

// Urutan klaim menentukan holder: seq/at terkecil menang.
export function openingHolder(claims) {
  if (!claims.length) return null;
  return [...claims].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))[0];
}

export function detectConflicts(claims) {
  const byTarget = new Map();
  for (const c of claims) {
    if (!byTarget.has(c.candidateId)) byTarget.set(c.candidateId, []);
    byTarget.get(c.candidateId).push(c);
  }
  const uncontested = [];
  const contested = [];
  for (const [targetId, list] of byTarget) {
    const sorted = [...list].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    if (sorted.length === 1) uncontested.push({ targetId, claims: sorted });
    else contested.push({ targetId, claims: sorted });
  }
  contested.sort((a, b) => (a.claims[0].at ?? 0) - (b.claims[0].at ?? 0));
  return { uncontested, contested };
}

export function validateBid({ auction, managerId, amount, budget }) {
  if (!auction || auction.status !== 'OPEN') return fail('Tidak ada lelang aktif.');
  if (!auction.eligible.includes(managerId)) return fail('Manager tidak ikut lelang ini.');
  if (auction.leaderId === managerId) return fail('Anda sudah memegang tawaran tertinggi.');
  const min = minNextBid(auction.currentBid);
  if (!(amount >= min - 1e-9)) return fail(`Tawaran minimal ${min}M (naik €${BID_STEP}M).`);
  if (amount > budget + 1e-9) return fail('Budget tidak cukup. Batas lelang adalah sisa budget.', 'BUDGET');
  return { ok: true };
}
