// Build snapshot Transfermarkt per klub → public/data.
//   Sampel bawaan : node scripts/build-snapshot.mjs --sample
//   Data asli     : node scripts/build-snapshot.mjs --from-csv <dir-csv> [--club <nama-klub>...]
// Dir CSV asli berisi players.csv, appearances.csv, clubs.csv, games.csv, game_lineups.csv
// (unduh dari https://github.com/dcaribou/transfermarkt-datasets, lisensi CC0).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'data');
const squadsDir = path.join(outDir, 'squads');

const SEASON = '25/26';
const CUTOFF = '2026-07-06';

// ---------------------------------------------------------------- Sampel bawaan
// Data contoh berformat snapshot (angka mendekati musim 25/26, BUKAN kutipan resmi).
const SAMPLE_CLUBS = [
  {
    id: 'tm_c_arsenal', name: 'Arsenal', league: 'Premier League', country: 'EN',
    coachNames: ['Mikel Arteta'],
    squad: [
      ['Raya', 'GK', 'GK', 29, 'ES', 45, 3420],
      ['Kepa Arrizabalaga', 'GK', 'GK', 31, 'ES', 12, 900],
      ['Tommy Setford', 'GK', 'GK', 20, 'EN', 3, 120],
      ['William Saliba', 'DEF', 'CB', 24, 'FR', 80, 3200],
      ['Gabriel Magalhaes', 'DEF', 'CB', 28, 'BR', 75, 3100],
      ['Ben White', 'DEF', 'RB', 28, 'EN', 45, 2200],
      ['Jurrien Timber', 'DEF', 'RB', 24, 'NL', 45, 2600],
      ['Riccardo Calafiori', 'DEF', 'LB', 23, 'IT', 40, 1800],
      ['Myles Lewis-Skelly', 'DEF', 'LB', 19, 'EN', 25, 1500],
      ['Oleksandr Zinchenko', 'DEF', 'LB', 29, 'UA', 25, 1200],
      ['Declan Rice', 'MID', 'CDM', 26, 'EN', 110, 3300],
      ['Martin Odegaard', 'MID', 'CAM', 27, 'NO', 100, 3000],
      ['Thomas Partey', 'MID', 'CDM', 32, 'GH', 20, 2500],
      ['Mikel Merino', 'MID', 'CM', 29, 'ES', 50, 2200],
      ['Christian Norgaard', 'MID', 'CDM', 31, 'DK', 25, 2100],
      ['Jorginho', 'MID', 'CDM', 34, 'IT', 10, 1400],
      ['Bukayo Saka', 'FWD', 'RW', 24, 'EN', 140, 2900],
      ['Kai Havertz', 'FWD', 'ST', 26, 'DE', 70, 3000],
      ['Gabriel Martinelli', 'FWD', 'LW', 24, 'BR', 60, 2700],
      ['Leandro Trossard', 'FWD', 'LW', 31, 'BE', 35, 2500],
      ['Gabriel Jesus', 'FWD', 'ST', 28, 'BR', 45, 1500],
      ['Ethan Nwaneri', 'FWD', 'RW', 18, 'EN', 30, 900],
      ['Raheem Sterling', 'FWD', 'LW', 31, 'EN', 25, 1100],
    ],
  },
  {
    id: 'tm_c_realmadrid', name: 'Real Madrid', league: 'La Liga', country: 'ES',
    coachNames: ['Xabi Alonso'],
    squad: [
      ['Thibaut Courtois', 'GK', 'GK', 34, 'BE', 30, 3000],
      ['Andriy Lunin', 'GK', 'GK', 26, 'UA', 20, 900],
      ['Fran Gonzalez', 'GK', 'GK', 21, 'ES', 4, 150],
      ['Antonio Rudiger', 'DEF', 'CB', 33, 'DE', 40, 3100],
      ['Eder Militao', 'DEF', 'CB', 28, 'BR', 50, 1800],
      ['David Alaba', 'DEF', 'CB', 34, 'AT', 20, 800],
      ['Dani Carvajal', 'DEF', 'RB', 34, 'ES', 25, 2000],
      ['Ferland Mendy', 'DEF', 'LB', 31, 'FR', 20, 1900],
      ['Fran Garcia', 'DEF', 'LB', 26, 'ES', 20, 1700],
      ['Trent Alexander-Arnold', 'DEF', 'RB', 27, 'EN', 70, 2800],
      ['Federico Valverde', 'MID', 'CM', 27, 'UY', 110, 3400],
      ['Jude Bellingham', 'MID', 'CAM', 23, 'EN', 140, 3200],
      ['Aurelien Tchouameni', 'MID', 'CDM', 26, 'FR', 70, 2800],
      ['Eduardo Camavinga', 'MID', 'CM', 23, 'FR', 60, 2000],
      ['Luka Modric', 'MID', 'CM', 40, 'HR', 10, 1500],
      ['Dani Ceballos', 'MID', 'CM', 29, 'ES', 20, 1300],
      ['Vinicius Junior', 'FWD', 'LW', 26, 'BR', 170, 3000],
      ['Kylian Mbappe', 'FWD', 'ST', 27, 'FR', 180, 3100],
      ['Rodrygo', 'FWD', 'RW', 25, 'BR', 80, 2700],
      ['Brahim Diaz', 'FWD', 'RW', 26, 'MA', 40, 1800],
      ['Endrick', 'FWD', 'ST', 19, 'BR', 35, 700],
      ['Arda Guler', 'FWD', 'CAM', 21, 'TR', 45, 1600],
    ],
  },
];

async function writeSample() {
  await fs.mkdir(squadsDir, { recursive: true });
  const clubs = [];
  const targets = [];
  for (const c of SAMPLE_CLUBS) {
    const squad = c.squad.map(([name, position, subPosition, age, nationality, price, minutes], i) => ({
      id: `tm_p_${c.id.replace('tm_c_', '')}_${i + 1}`,
      type: 'PLAYER', name, position, subPosition, age, nationality,
      clubId: c.id, price, minutes,
    }));
    const snap = {
      version: '2026.1-sample', season: SEASON, cutoff: CUTOFF, currency: 'EUR_M',
      source: 'sample (format dcaribou/transfermarkt-datasets)', sample: true,
      club: { id: c.id, name: c.name, league: c.league, country: c.country, season: SEASON, cutoff: CUTOFF },
      squad, coachNames: c.coachNames, minutesSeason: '2025',
    };
    await fs.writeFile(path.join(squadsDir, `${c.id}.json`), JSON.stringify(snap, null, 2));
    clubs.push({ ...snap.club, squadSize: squad.length, sample: true, coachNames: c.coachNames });
    for (const p of squad) targets.push({ ...p, clubName: c.name });
    console.log('snapshot sampel:', c.id, squad.length, 'pemain');
  }
  await fs.writeFile(path.join(outDir, 'clubs.json'),
    JSON.stringify({ version: '2026.1-sample', season: SEASON, cutoff: CUTOFF, source: 'sample', sample: true, clubs }, null, 2));
  await fs.writeFile(path.join(outDir, 'targets.json'),
    JSON.stringify({ version: '2026.1-sample', season: SEASON, cutoff: CUTOFF, source: 'sample', sample: true, players: targets }, null, 2));
  console.log('clubs.json:', clubs.length, 'klub; targets.json:', targets.length, 'pemain luar-klub');
}

// ------------------------------------------------------- Konversi CSV asli
function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function readCsvMaybeGz(file) {
  const gz = `${file}.gz`;
  try {
    const buf = await fs.readFile(gz);
    return zlib.gunzipSync(buf).toString('utf8');
  } catch {
    return fs.readFile(file, 'utf8');
  }
}

function toRows(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const head = splitCsv(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(head.map((h, i) => [h, splitCsv(l)[i] ?? ''])));
}

// Pemetaan posisi Transfermarkt → internal.
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

function mapPos(position, sub) {
  for (const [re, p, s] of POSMAP) {
    if (re.test(sub || '') || re.test(position || '')) return [p, s];
  }
  return ['MID', 'CM'];
}

async function fromCsv(dir, onlyNames) {
  const players = toRows(await readCsvMaybeGz(path.join(dir, 'players.csv')));
  const clubs = toRows(await readCsvMaybeGz(path.join(dir, 'clubs.csv')));
  let minutes = {};
  try {
    const apps = toRows(await readCsvMaybeGz(path.join(dir, 'appearances.csv')));
    for (const a of apps) {
      const m = Number(a.minutes_played ?? 0);
      if (!Number.isFinite(m)) continue;
      minutes[a.player_id] = (minutes[a.player_id] ?? 0) + m;
    }
    console.log('agregat menit:', Object.keys(minutes).length, 'pemain');
  } catch {
    console.log('appearances.csv tak ada — fallback market value.');
  }
  let coachByClub = {};
  try {
    const games = toRows(await readCsvMaybeGz(path.join(dir, 'games.csv')));
    const latest = {};
    for (const g of games) {
      for (const [cid, nm] of [[g.home_club_id, g.home_club_manager_name], [g.away_club_id, g.away_club_manager_name]]) {
        if (!cid || !nm) continue;
        if (!latest[cid] || (g.date ?? '') > (latest[cid].date ?? '')) latest[cid] = { name: nm, date: g.date };
      }
    }
    coachByClub = Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, [v.name]]));
  } catch {
    console.log('games.csv tak ada — nama pelatih kosong.');
  }
  const wanted = onlyNames.length ? onlyNames.map((s) => s.toLowerCase()) : null;
  const picked = clubs.filter((c) => !wanted || wanted.some((w) => (c.name ?? '').toLowerCase().includes(w)));
  await fs.mkdir(squadsDir, { recursive: true });
  const out = [];
  const targets = [];
  for (const c of picked) {
    const cid = c.club_id;
    const squad = players
      .filter((p) => String(p.current_club_id) === String(cid))
      .map((p) => {
        const [position, subPosition] = mapPos(p.position, p.sub_position);
        return {
          id: `tm_p_${p.player_id}`, type: 'PLAYER', name: p.name, position, subPosition,
          age: Number(p.age) || 24, nationality: p.country_of_citizenship ?? p.nationality ?? '',
          clubId: `tm_c_${cid}`,
          price: Math.round((Number(p.market_value_in_eur) || 0) / 1e6 * 10) / 10,
          minutes: minutes[p.player_id] ?? 0,
        };
      })
      .filter((p) => p.name && p.price >= 0);
    if (squad.length < 14) { console.log('lewati (skuad kurang):', c.name, squad.length); continue; }
    const snap = {
      version: '2026.1', season: SEASON, cutoff: CUTOFF, currency: 'EUR_M',
      source: 'dcaribou/transfermarkt-datasets', sample: false,
      club: { id: `tm_c_${cid}`, name: c.name, league: c.domestic_competition_name ?? c.domestic_competition_id ?? '', country: c.country_name ?? '', season: SEASON, cutoff: CUTOFF },
      squad, coachNames: coachByClub[cid] ?? [], minutesSeason: '2025',
    };
    await fs.writeFile(path.join(squadsDir, `tm_c_${cid}.json`), JSON.stringify(snap));
    out.push({ ...snap.club, squadSize: squad.length, sample: false, coachNames: coachByClub[cid] ?? [] });
    for (const p of squad) targets.push({ ...p, clubName: c.name });
    console.log('snapshot:', snap.club.name, squad.length, 'pemain');
  }
  await fs.writeFile(path.join(outDir, 'clubs.json'),
    JSON.stringify({ version: '2026.1', season: SEASON, cutoff: CUTOFF, source: 'dcaribou/transfermarkt-datasets', sample: false, clubs: out }, null, 2));
  await fs.writeFile(path.join(outDir, 'targets.json'),
    JSON.stringify({ version: '2026.1', season: SEASON, cutoff: CUTOFF, source: 'dcaribou/transfermarkt-datasets', sample: false, players: targets }, null, 2));
}

const args = process.argv.slice(2);
if (args.includes('--sample')) await writeSample();
else if (args.includes('--from-csv')) {
  const dir = args[args.indexOf('--from-csv') + 1];
  const ci = args.indexOf('--club');
  const names = ci >= 0 ? args.slice(ci + 1) : [];
  if (!dir) { console.error('butuh direktori csv'); process.exit(1); }
  await fromCsv(dir, names);
} else {
  console.log('pakai: node scripts/build-snapshot.mjs --sample | --from-csv <dir> [--club <nama>...]');
}
