// Compose v3: susun Starting XI + 3 kandidat per slot dari skuad klub.
// OTOMATIS fokus ke starter: starter = menit terbanyak, kandidat = menit
// terbanyak dari bursa luar klub se-grup. ACAK: starter acak dari skuad,
// kandidat = acak dari bursa luar klub yang cocok posisi slot itu.
import { rngFrom } from '../services/rng.js';

// Ambang menit tinggi untuk validasi harga bursa acak (pilihan desainer).
export const HIGH_MINUTES = 2000;

// Gap minimum antar harga kandidat dalam satu slot (€M, pilihan desainer).
export const MIN_PRICE_GAP = 10;

// Validasi harga-menit khusus random pick (harga asli TIDAK diubah):
// menit tinggi (≥2000) → harga €5M–€10M; menit rendah → harga ≥ €10M.
export function passesPriceMinutesRule(p) {
  const mins = p.minutes ?? 0;
  const pr = p.price ?? 0;
  if (mins >= HIGH_MINUTES) return pr >= 5 && pr <= 10;
  return pr >= 10;
}

export function groupOf(entity) {
  if (entity.type === 'COACH') return 'COACH';
  return entity.position;
}

function byMinutesDesc(a, b) {
  // Harga nol (data upstream kosong) selalu diurutkan paling belakang
  // agar tidak jadi starter/kandidat gratis yang merusak ekonomi game.
  const az = (a.price ?? 0) > 0 ? 0 : 1;
  const bz = (b.price ?? 0) > 0 ? 0 : 1;
  if (az !== bz) return az - bz;
  if ((b.minutes ?? 0) !== (a.minutes ?? 0)) return (b.minutes ?? 0) - (a.minutes ?? 0);
  return (b.price ?? 0) - (a.price ?? 0);
}

// Isi starter tiap slot: pemain skuad yang cocok penuh (faktor 100%)
// dengan menit terbanyak dan belum dipakai. Tanpa fallback sembarang:
// bila tak ada yang cocok, slot dibiarkan kosong untuk diisi manual.
export function autoXI(squad, slotDefs) {
  const used = new Set();
  const result = {};
  for (const def of slotDefs) {
    if (def.slotId === 'COACH') continue;
    const cands = squad
      .filter((p) => {
        if (p.type !== 'PLAYER' || used.has(p.id)) return false;
        const r = isCompatible(p, def);
        return r.ok && r.factor === 1;
      })
      .sort(byMinutesDesc);
    const pick = cands[0] ?? null;
    if (pick) { used.add(pick.id); result[def.slotId] = pick.id; }
  }
  return { starters: result, used };
}

// 3 kandidat per slot dari LUAR klub (bursa transfer).
// OTOMATIS hanya mengisi yang cocok (penuh faktor 100% atau sebagian ×0,95)
// diurut menit; tanpa backfill tak cocok: bila yang cocok kurang dari 3,
// slot dibiarkan kurang dan moderator melengkapi manual (validasi menolak
// kunci draft).
// Unik per grup posisi: id yang sudah jadi starter/kandidat slot se-grup
// tidak dipakai lagi (satu pemain satu posisi).
import { isCompatible } from './slots.js';

export function autoCandidates(externalPool, slotDefs, clubId, startersBySlot = {}) {
  const pool = externalPool.filter((p) => p.type === 'PLAYER' && p.clubId !== clubId);
  const defOf = Object.fromEntries(slotDefs.map((d) => [d.slotId, d]));
  const usedByGroup = {};
  for (const [sid, starterId] of Object.entries(startersBySlot)) {
    const g = defOf[sid]?.group;
    if (g && starterId) {
      usedByGroup[g] = usedByGroup[g] ?? new Set();
      usedByGroup[g].add(starterId);
    }
  }
  const out = {};
  const usedGlobal = new Set(Object.values(startersBySlot).filter(Boolean));
  for (const def of slotDefs) {
    if (def.slotId === 'COACH') continue;
    const used = (usedByGroup[def.group] = usedByGroup[def.group] ?? new Set());
    const same = pool
      .filter((p) => {
        if (used.has(p.id)) return false;
        return isCompatible(p, def).ok;
      })
      .sort(byMinutesDesc);
    // Urutan bursa menaik menurut harga: pilihan 1 termurah, 3 termahal.
    out[def.slotId] = same
      .slice(0, 3)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
      .map((p) => p.id);
    out[def.slotId].forEach((id) => { used.add(id); usedGlobal.add(id); });
  }
  return out;
}

export function randomCompose(squad, externalPool, slotDefs, clubId, seedStr, fixedStarters = null) {
  const { next } = rngFrom(seedStr);
  const pool = [...squad.filter((p) => p.type === 'PLAYER')];
  // Starter: pakai yang diberikan (mis. menit terbanyak, stabil tiap klik),
  // atau undi bila tidak diberikan.
  let starters = {};
  if (fixedStarters) {
    starters = { ...fixedStarters };
  } else {
    const used = new Set();
    const order = [...slotDefs.filter((d) => d.slotId !== 'COACH')];
    // Kocok pool lalu isi serakah per grup.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const def of order) {
      const idx = pool.findIndex((p) => !used.has(p.id) && p.position === def.group);
      const pick = idx >= 0 ? pool[idx] : pool.find((p) => !used.has(p.id));
      if (pick) { used.add(pick.id); starters[def.slotId] = pick.id; }
    }
  }
  const order = [...slotDefs.filter((d) => d.slotId !== 'COACH')];
  const ext = [...externalPool.filter((p) => p.type === 'PLAYER' && p.clubId !== clubId)];
  for (let i = ext.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ext[i], ext[j]] = [ext[j], ext[i]];
  }
  const candidates = {};
  const defOf = Object.fromEntries(slotDefs.map((d) => [d.slotId, d]));
  const usedByGroup = {};
  for (const [sid, starterId] of Object.entries(starters)) {
    const g = defOf[sid]?.group;
    if (g && starterId) {
      usedByGroup[g] = usedByGroup[g] ?? new Set();
      usedByGroup[g].add(starterId);
    }
  }
  for (const def of order) {
    // Acak tetapi HANYA yang cocok penuh (factor 1, tanpa sebagian), unik
    // se-grup, HARGA UNIK per slot dengan GAP minimal €10M antar kandidat,
    // plus lolos validasi harga-menit. Tanpa backfill: bila kurang dari 3,
    // slot dibiarkan kurang untuk dilengkapi manual.
    const used = (usedByGroup[def.group] = usedByGroup[def.group] ?? new Set());
    const eligible = ext.filter((p) => {
      if (used.has(p.id) || p.position !== def.group) return false;
      const r = isCompatible(p, def);
      return r.ok && r.factor === 1 && passesPriceMinutesRule(p);
    });
    // Multi-pass: serakah rakus sekali jalan bisa gagal padahal triple valid
    // ada (urutan kocokan menjebak). Coba sampai 8 kocokan, simpan terbanyak.
    let picked = [];
    for (let attempt = 0; attempt < 8 && picked.length < 3; attempt++) {
      const order2 = [...eligible];
      for (let i = order2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [order2[i], order2[j]] = [order2[j], order2[i]];
      }
      const seenPrices = [];
      const cur = [];
      for (const p of order2) {
        if (cur.length >= 3) break;
        const price = p.price ?? 0;
        if (seenPrices.some((q) => Math.abs(q - price) < MIN_PRICE_GAP)) continue;
        seenPrices.push(price);
        cur.push(p);
      }
      if (cur.length > picked.length) picked = cur;
    }
    candidates[def.slotId] = picked
      .slice(0, 3)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
      .map((p) => p.id);
    candidates[def.slotId].forEach((id) => used.add(id));
  }
  return { starters, candidates };
}

export function validateCompose(compose, slotDefs, entityMap, clubId) {
  const errors = [];
  const seenByGroup = {};
  for (const def of slotDefs) {
    if (def.slotId === 'COACH') continue;
    const slot = compose.slots?.[def.slotId];
    if (!slot?.starterId || !entityMap.get(slot.starterId)) errors.push(`Starter ${def.slotId} belum valid.`);
    const seen = (seenByGroup[def.group] = seenByGroup[def.group] ?? new Map());
    const claim = (id, label) => {
      if (!id) return;
      if (seen.has(id)) {
        const other = seen.get(id);
        const nm = entityMap.get(id)?.name ?? id;
        errors.push(`${nm} sudah dipakai di posisi ${def.group} (${other}).`);
      } else {
        seen.set(id, label);
      }
    };
    claim(slot?.starterId, `starter ${def.slotId}`);
    const cands = slot?.candidateIds ?? [];
    if (cands.length !== 3) { errors.push(`Kandidat ${def.slotId} harus tepat 3.`); continue; }
    if (new Set(cands).size !== 3) errors.push(`Kandidat ${def.slotId} duplikat.`);
    for (const id of cands) {
      const ent = entityMap.get(id);
      if (!ent) errors.push(`Kandidat ${id} (${def.slotId}) tak dikenal.`);
      else if (clubId && ent.clubId === clubId) errors.push(`Kandidat ${ent.name} (${def.slotId}) harus dari luar klub.`);
      if (id === slot?.starterId) errors.push(`Kandidat ${def.slotId} sama dengan starter.`);
      else claim(id, `bursa ${def.slotId}`);
    }
  }
  return errors;
}
