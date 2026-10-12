// Format Euro dalam juta: 12.5 -> €12.5M
export function formatEuro(millions) {
  const n = Number(millions);
  if (!Number.isFinite(n)) return '€0M';
  const rounded = Math.round(n * 10) / 10;
  return `€${rounded.toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`;
}

export function sellPriceOf(player, sellFactor = 0.85) {
  return Math.round(player.price * sellFactor * 10) / 10;
}

// Normalisasi teks untuk pencarian: huruf kecil, tanpa diakritik
// ("Mbappé" ketemu saat diketik "mbappe"). NFD tidak mengurai Ø/æ/œ/ss,
// jadi dipetakan eksplisit.
export function normText(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/ð/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Harga pasar pelatih selalu kelipatan 5 (€10M–€50M) plus tier murah €5M.
// Di bawah 7,5 → €5M, selainnya dibulatkan ke kelipatan 5 terdekat (maks 50).
export function coachPriceTier(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 7.5) return 5;
  return Math.min(50, Math.max(10, Math.round(n / 5) * 5));
}

// Estimasi mentah sebelum tier: performa tim + pengalaman.
// teamValue = total market value skuad (€M), tenureYears = masa jabatan (thn).
export function estimateCoachPrice({ tenureYears = 0, teamValue = 0 } = {}) {
  const t = Number(tenureYears) || 0;
  const v = Number(teamValue) || 0;
  return coachPriceTier(v * 0.02 + t * 1.5);
}

// Harga jual sesuai config sesi: bila potongan nonaktif, jual full 100%.
export function sellPriceFor(entity, config) {
  if (!entity) return 0;
  if (config?.sellFactorEnabled === false) return Math.round(entity.price * 10) / 10;
  return sellPriceOf(entity, config?.sellFactor ?? 0.85);
}
