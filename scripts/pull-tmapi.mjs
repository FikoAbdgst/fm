// Tarik snapshot per klub dari felipeall/transfermarkt-api → public/data.
//   node scripts/pull-tmapi.mjs --check
//   node scripts/pull-tmapi.mjs --clubs "Arsenal,Real Madrid" [--base URL] [--force]
//   node scripts/pull-tmapi.mjs --preset-60
// Throttle default aman untuk demo publik (2 req / 3 dtk / IP).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'data');
const squadsDir = path.join(outDir, 'squads');
const cacheDir = path.join(root, '.tmapi-cache');

const COMPS = [
  { code: 'GB1', league: 'Premier League', country: 'EN' },
  { code: 'ES1', league: 'La Liga', country: 'ES' },
  { code: 'IT1', league: 'Serie A', country: 'IT' },
  { code: 'L1', league: 'Bundesliga', country: 'DE' },
  { code: 'FR1', league: 'Ligue 1', country: 'FR' },
];

// Top 10 musim 25/26 (final) untuk ES1/IT1/L1/FR1; EPL di-resolve dinamis (20 klub 26/27).
const PRESET_TOP10 = {
  ES1: ['Barcelona', 'Real Madrid', 'Villarreal', 'Atletico Madrid', 'Real Betis', 'Celta Vigo', 'Getafe', 'Rayo Vallecano', 'Valencia', 'Real Sociedad'],
  IT1: ['Inter', 'Napoli', 'Roma', 'Como', 'AC Milan', 'Juventus', 'Atalanta', 'Bologna', 'Lazio', 'Udinese'],
  L1: ['Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'VfB Stuttgart', 'Hoffenheim', 'Bayer Leverkusen', 'Freiburg', 'Eintracht Frankfurt', 'Augsburg', 'Mainz'],
  FR1: ['Paris Saint-Germain', 'Lens', 'Lille', 'Lyon', 'Marseille', 'Rennes', 'Monaco', 'Strasbourg', 'Toulouse', 'Lorient'],
};

const POSMAP = [
  [/goalkeeper/i, 'GK', 'GK'],
  [/centre-back|center.?back/i, 'DEF', 'CB'],
  [/left-back/i, 'DEF', 'LB'],
  [/right-back/i, 'DEF', 'RB'],
  [/left.?wing.?back/i, 'DEF', 'LWB'],
  [/right.?wing.?back/i, 'DEF', 'RWB'],
  [/defensive midfield/i, 'MID', 'CDM'],
  [/central midfield/i, 'MID', 'CM'],
  [/attacking midfield/i, 'MID', 'CAM'],
  [/left midfield/i, 'MID', 'LM'],
  [/right midfield/i, 'MID', 'RM'],
  [/left winger/i, 'FWD', 'LW'],
  [/right winger/i, 'FWD', 'RW'],
  [/centre-forward|center.?forward|striker/i, 'FWD', 'ST'],
  [/second striker/i, 'FWD', 'ST'],
  [/^defen[cs]e$/i, 'DEF', 'CB'],
  [/^midfield$/i, 'MID', 'CM'],
  [/^attack$/i, 'FWD', 'ST'],
];
const unknownPos = new Set();
function mapPos(position) {
  for (const [re, p, s] of POSMAP) {
    if (re.test(position || '')) return [p, s];
  }
  unknownPos.add(position);
  return ['MID', 'CM'];
}

function parseMoney(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v >= 10000 ? Math.round(v / 1e6 * 10) / 10 : v;
  const s = String(v).replace(/[€\s,]/g, '');
  const m = s.match(/^([\d.]+)(m|k|bn)?$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  const mult = (m[2] || '').toLowerCase() === 'k' ? 1 / 1000 : (m[2] || '').toLowerCase() === 'bn' ? 1000 : 1;
  return Math.round(n * mult * 10) / 10;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
async function call(url, { throttleMs, cache = true, retries = 4 }) {
  const key = Buffer.from(url).toString('base64url');
  const cf = path.join(cacheDir, key + '.json');
  if (cache) {
    try { return JSON.parse(await fs.readFile(cf, 'utf8')); } catch { /* miss */ }
  }
  for (let attempt = 0; ; attempt++) {
    const wait = throttleMs - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      try { await fs.mkdir(cacheDir, { recursive: true }); await fs.writeFile(cf, JSON.stringify(json)); } catch { /* abaikan */ }
      return json;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${res.status} untuk ${url}`);
  }
}

const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const normText = (s) => norm(s).replace(/ /g, '');
function findClubId(clubs, name) {
  const tokens = norm(name).split(' ').filter((t) => t.length > 2 && !['de', 'la', 'fc', 'cf', 'ac', 'as', 'rc', 'sc'].includes(t));
  const cands = clubs.filter((c) => {
    const cn = norm(c.name);
    return tokens.every((t) => cn.includes(t));
  });
  if (!cands.length) return null;
  // Pilih yang token-nya paling pas (paling sedikit kata ekstra).
  cands.sort((a, b) => norm(a.name).length - norm(b.name).length);
  return cands[0];
}

async function pullClub(base, apiId, apiName, league, country, o) {
  const t0 = Date.now();
  let profile = {};
  try { profile = await call(`${base}/clubs/${apiId}/profile`, o); } catch (e) { console.log('  profil gagal:', e.message); }
  let squadRaw = [];
  for (const qs of [`?season_id=${o.squadSeason}`, '']) {
    try {
      const r = await call(`${base}/clubs/${apiId}/players${qs}`, o);
      squadRaw = Array.isArray(r) ? r : r.players ?? r.squad ?? [];
      if (squadRaw.length) break;
    } catch (e) { console.log('  skuad gagal:', e.message); }
  }
  const squad = [];
  const missingPrice = [];
  for (const p of squadRaw) {
    const pid = p.id ?? p.playerId;
    if (!pid) continue;
    let minutes = 0;
    try {
      const st = await call(`${base}/players/${pid}/stats`, o);
      const rows = Array.isArray(st) ? st : st.stats ?? [];
      for (const r of rows) {
        if (String(r.seasonId ?? r.season_id ?? '') === String(o.minutesSeason)) {
          minutes += Number(r.minutesPlayed ?? r.minutes_played ?? 0) || 0;
        }
      }
    } catch { /* menit 0 */ }
    const [position, subPosition] = mapPos(p.position);
    const price = parseMoney(p.marketValue ?? p.market_value);
    const entry = {
      id: `tm_p_${pid}`, type: 'PLAYER', name: p.name, position, subPosition,
      age: Number(p.age) || 24, nationality: p.nationality ?? p.citizenship ?? '',
      clubId: `tm_c_${apiId}`, price, minutes,
    };
    if (!price) missingPrice.push(entry);
    squad.push(entry);
  }
  // Upstream kadang null untuk seluruh skuad: isi via endpoint market_value.
  for (const entry of missingPrice) {
    try {
      const pid = entry.id.replace('tm_p_', '');
      const mv = await call(`${base}/players/${pid}/market_value`, o);
      const v = mv?.marketValue ?? mv?.market_value ?? 0;
      entry.price = parseMoney(v);
    } catch { /* tetap 0 */ }
  }
  const valid = squad.filter((p) => p.name && Number.isFinite(p.price));
  const coachNames = [profile.coach?.name, profile.manager, profile.currentCoach, profile.headCoach]
    .filter((x) => typeof x === 'string' && x.trim()).slice(0, 1);
  const id = `tm_c_${apiId}`;
  const snap = {
    version: '2026.2', season: '26/27', cutoff: new Date().toISOString().slice(0, 10),
    currency: 'EUR_M', source: 'felipeall/transfermarkt-api', sample: false,
    club: { id, name: apiName, league, country, season: '26/27', cutoff: new Date().toISOString().slice(0, 10) },
    squad: valid, coachNames, minutesSeason: String(o.minutesSeason),
  };
  await fs.mkdir(squadsDir, { recursive: true });
  await fs.writeFile(path.join(squadsDir, `${id}.json`), JSON.stringify(snap));
  console.log(`OK ${apiName}: ${valid.length} pemain (${Math.round((Date.now() - t0) / 1000)}s)`);
  return { entry: { ...snap.club, squadSize: valid.length, sample: false, coachNames }, players: valid.map((p) => ({ ...p, clubName: apiName })) };
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

const base = (arg('--base', 'https://transfermarkt-api.fly.dev')).replace(/\/$/, '');
const o = {
  throttleMs: Number(arg('--throttle-ms', process.env.TMAPI_THROTTLE_MS ?? 1600)),
  minutesSeason: arg('--minutes-season', '2025'),
  squadSeason: arg('--squad-season', '2026'),
  cache: !process.argv.includes('--no-cache'),
  force: process.argv.includes('--force'),
};

if (process.argv.includes('--check')) {
  const h = await fetch(`${base}/health`).then((r) => r.text()).catch((e) => `GAGAL: ${e.message}`);
  console.log('health:', h.slice(0, 200));
  process.exit(0);
}

// Mode isi harga kosong: untuk pemain ber-price 0 di snapshot, tarik
// /players/{id}/market_value lalu tulis ulang snapshot + targets.json.
if (process.argv.includes('--fill-prices')) {
  const files = (await fs.readdir(squadsDir)).filter((f) => f.endsWith('.json'));
  let filled = 0;
  const allPlayers = [];
  for (const f of files) {
    const fp = path.join(squadsDir, f);
    const snap = JSON.parse(await fs.readFile(fp, 'utf8'));
    for (const p of snap.squad) {
      if (p.price) continue;
      try {
        const mv = await call(`${base}/players/${String(p.id).replace('tm_p_', '')}/market_value`, o);
        p.price = parseMoney(mv?.marketValue ?? mv?.market_value ?? 0);
        if (p.price) { filled++; console.log(`harga ${p.name}: €${p.price}M`); }
      } catch { /* tetap 0 */ }
    }
    await fs.writeFile(fp, JSON.stringify(snap));
    for (const p of snap.squad) allPlayers.push({ ...p, clubName: snap.club.name });
    console.log(`cek ${snap.club.name}: ${snap.squad.filter((p) => !p.price).length} masih nol`);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  await fs.writeFile(path.join(outDir, 'targets.json'), JSON.stringify(
    { version: '2026.2', season: '26/27', cutoff: stamp, source: 'felipeall/transfermarkt-api', sample: false, players: allPlayers }));
  console.log(`SELESAI harga: ${filled} terisi, bursa ${allPlayers.length} pemain`);
  process.exit(0);
}

// Mode pelatih saja: profil tiap pelatih kepala 60 klub → public/data/coaches.json.
// Id pelatih diambil dari profil klub (cache, instan); yang ditarik hanya profil pelatih.
if (process.argv.includes('--coaches-only')) {
  const clubsJson = JSON.parse(await fs.readFile(path.join(outDir, 'clubs.json'), 'utf8'));
  const apiIdOf = new Map();
  for (const f of await fs.readdir(squadsDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const snap = JSON.parse(await fs.readFile(path.join(squadsDir, f), 'utf8'));
      const m = String(snap.club?.id ?? '').match(/^tm_c_(\d+)$/);
      if (m) apiIdOf.set(snap.club.id, m[1]);
    } catch { /* lewati */ }
  }
  const coaches = [];
  const coachSince = new Map();
  const teamValue = new Map();
  for (const f of await fs.readdir(squadsDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const snap = JSON.parse(await fs.readFile(path.join(squadsDir, f), 'utf8'));
      teamValue.set(snap.club.id, Math.round(snap.squad.reduce((a, p) => a + (Number(p.price) || 0), 0)));
    } catch { /* lewati */ }
  }
  const tenureOf = (since) => {
    const t = new Date(since).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, Math.round((Date.now() - t) / 3.15576e10 * 10) / 10);
  };
  for (const club of clubsJson.clubs) {
    const apiId = apiIdOf.get(club.id);
    if (!apiId) continue;
    let coachId = null;
    try {
      const prof = await call(`${base}/clubs/${apiId}/profile`, o);
      coachId = prof?.coach?.id ?? null;
      if (prof?.coach?.since) coachSince.set(club.id, prof.coach.since);
    } catch (e) { console.log('profil gagal:', club.name, e.message); }
    if (!coachId) { console.log('tanpa id pelatih:', club.name); continue; }
    try {
      const cp = await call(`${base}/coaches/${coachId}/profile`, o);
      const tenure = tenureOf(coachSince.get(club.id));
      const value = teamValue.get(club.id) ?? 0;
      // Rating kurasi dari pengalaman + level tim (terdokumentasi, bukan resmi):
      // 72 dasar + 1,2 per tahun jabatan + nilai skuad/200e6, batas 65-92.
      const rating = Math.min(92, Math.max(65, Math.round(72 + tenure * 1.2 + value / 200)));
      coaches.push({
        id: `tm_h_${coachId}`, type: 'COACH', name: cp.name, age: Number(cp.age) || 50,
        nationality: Array.isArray(cp.citizenship) ? cp.citizenship.join(', ') : (cp.citizenship ?? ''),
        clubId: club.id, clubName: club.name, license: cp.license ?? '',
        tenureYears: tenure, teamValue: value, rating,
        price: Math.min(45, Math.max(2, Math.round(value * 0.02 + tenure * 1.5))),
        freeAgent: false,
      });
      console.log(`OK pelatih ${cp.name} (${club.name})`);
    } catch (e) { console.log('pelatih gagal:', club.name, e.message); }
  }
  // Gabung 20 free agent kurasi (scripts/free-agents.json).
  try {
    const fa = JSON.parse(await fs.readFile(path.join(root, 'scripts', 'free-agents.json'), 'utf8'));
    const have = new Set(coaches.map((c) => normText(c.name)));
    for (const f of fa) {
      if (have.has(normText(f.name))) continue;
      const rating = Math.min(93, Math.max(65, Number(f.rating) || 78));
      coaches.push({
        id: `tm_h_fa_${normText(f.name).replace(/[^a-z0-9]+/g, '_')}`,
        type: 'COACH', name: f.name, age: Number(f.age) || 50, nationality: '',
        clubId: null, clubName: 'Free Agent', license: '',
        tenureYears: 0, teamValue: 0, rating,
        price: Math.min(50, Math.max(1, Math.round((rating - 65) * 1.5))),
        freeAgent: true,
      });
    }
    console.log('free agent digabung:', fa.length);
  } catch (e) { console.log('free-agents.json terlewat:', e.message); }
  const stamp = new Date().toISOString().slice(0, 10);
  await fs.writeFile(path.join(outDir, 'coaches.json'), JSON.stringify(
    { version: '2026.2', season: '26/27', cutoff: stamp, source: 'felipeall/transfermarkt-api', sample: false, coaches }, null, 2));
  console.log(`SELESAI pelatih: ${coaches.length} dari ${clubsJson.clubs.length} klub`);
  process.exit(0);
}

// Resolve daftar klub.
let wanted = [];
if (process.argv.includes('--preset-60')) {
  wanted.push({ comp: 'GB1', mode: 'all' });
  for (const [comp, names] of Object.entries(PRESET_TOP10)) wanted.push({ comp, mode: 'names', names });
} else {
  const list = (arg('--clubs', '')).split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) { console.log('pakai --clubs "A,B" atau --preset-60'); process.exit(1); }
  wanted.push({ comp: null, mode: 'names', names: list });
}

const targets = [];
const clubEntries = [];
for (const w of wanted) {
  const comps = w.comp ? [COMPS.find((c) => c.code === w.comp)] : COMPS;
  for (const comp of comps) {
    if (!comp) continue;
    let listing = [];
    try {
      const r = await call(`${base}/competitions/${comp.code}/clubs`, o);
      listing = Array.isArray(r) ? r : r.clubs ?? [];
    } catch (e) { console.log(`listing ${comp.code} gagal:`, e.message); continue; }
    const names = w.mode === 'all' ? listing.map((c) => c.name) : w.names;
    for (const nm of names) {
      const hit = w.mode === 'all'
        ? listing.find((c) => c.name === nm)
        : findClubId(listing, nm);
      if (!hit) { console.log('TIDAK KETEMU:', nm, comp.code); continue; }
      const id = `tm_c_${hit.id}`;
      if (!o.force) {
        try {
          await fs.access(path.join(squadsDir, `${id}.json`));
          console.log('LEWATI (sudah ada, pakai --force untuk ulang):', hit.name);
          continue;
        } catch { /* belum ada */ }
      }
      try {
        const r = await pullClub(base, hit.id, hit.name, comp.league, comp.country, o);
        clubEntries.push(r.entry);
        targets.push(...r.players);
      } catch (e) { console.log('GAGAL klub', hit.name, e.message); }
    }
  }
}

// Merge ke clubs.json + targets.json: dari hasil run ini DITAMBAH semua
// snapshot yang sudah ada di disk (self-healing bila run terputus).
await fs.mkdir(outDir, { recursive: true });
const byId = new Map();
const tById = new Map();
try {
  const files = await fs.readdir(squadsDir);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const snap = JSON.parse(await fs.readFile(path.join(squadsDir, f), 'utf8'));
      if (!snap?.club?.id || !Array.isArray(snap.squad)) continue;
      byId.set(snap.club.id, { ...snap.club, squadSize: snap.squad.length, sample: snap.sample === true, coachNames: snap.coachNames ?? [] });
      for (const p of snap.squad) {
        if (p?.id) tById.set(p.id, { ...p, clubName: snap.club.name });
      }
    } catch { /* file rusak, lewati */ }
  }
} catch { /* belum ada snapshot */ }
for (const e of clubEntries) byId.set(e.id, e);
for (const p of targets) tById.set(p.id, p);
const stamp = new Date().toISOString().slice(0, 10);
const allSample = [...byId.values()].every((c) => c.sample);
await fs.writeFile(path.join(outDir, 'clubs.json'), JSON.stringify(
  { version: '2026.2', season: '26/27', cutoff: stamp, source: 'felipeall/transfermarkt-api', sample: allSample, clubs: [...byId.values()] }, null, 2));
await fs.writeFile(path.join(outDir, 'targets.json'), JSON.stringify(
  { version: '2026.2', season: '26/27', cutoff: stamp, source: 'felipeall/transfermarkt-api', sample: allSample, players: [...tById.values()] }));
if (unknownPos.size) console.log('POSISI TAK DIKENAL:', [...unknownPos]);
console.log(`SELESAI: ${clubEntries.length} klub baru, total ${byId.size} klub, ${tById.size} pemain bursa`);
