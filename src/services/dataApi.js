// Data layer v3: snapshot Transfermarkt per klub (build-time) + fallback lokal.
// Rating = estimasi transparan (dataset tak menyediakan overall ala FIFA).
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

export function tierFor(p) {
  if (p.tier) return p.tier;
  if (p.rating >= 85) return 'STAR';
  if ((p.age ?? 99) <= 21) return 'YOUNG';
  if (p.rating >= 70) return 'MID';
  return 'FILLER';
}

// rating = clamp(60, 90, 65 + menitNorm*10 + valueNorm*15), normalisasi dalam skuad.
export function estimateRating(price, minutes, maxPrice, maxMinutes) {
  const mn = maxMinutes > 0 ? minutes / maxMinutes : 0;
  const vn = maxPrice > 0 ? price / maxPrice : 0;
  return Math.min(90, Math.max(60, Math.round(65 + mn * 10 + vn * 15)));
}

export function normalizeSquadPlayer(raw, maxPrice, maxMinutes) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  const name = String(raw.name ?? '').trim();
  const position = String(raw.position ?? '').toUpperCase();
  const price = Number(raw.price);
  if (!id || !name || !POSITIONS.includes(position)) return null;
  if (!Number.isFinite(price) || price < 0) return null;
  const rating = estimateRating(price, Number(raw.minutes) || 0, maxPrice, maxMinutes);
  return {
    id, type: 'PLAYER', name, position,
    subPosition: raw.subPosition ?? position,
    age: Number.isFinite(Number(raw.age)) ? Number(raw.age) : 24,
    nationality: raw.nationality ?? '',
    clubId: raw.clubId ?? '',
    rating,
    price: Math.round(price * 10) / 10,
    minutes: Number(raw.minutes) || 0,
    tier: tierFor({ rating, age: Number(raw.age) }),
    estimated: true,
    image: raw.image ?? '',
  };
}

export function normalizeSnapshot(snap) {
  if (!snap || !snap.club || !Array.isArray(snap.squad)) return null;
  const maxPrice = Math.max(1, ...snap.squad.map((p) => Number(p.price) || 0));
  const maxMinutes = Math.max(1, ...snap.squad.map((p) => Number(p.minutes) || 0));
  const seen = new Set();
  const squad = [];
  for (const raw of snap.squad) {
    const p = normalizeSquadPlayer(raw, maxPrice, maxMinutes);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    squad.push(p);
  }
  return {
    version: snap.version ?? '',
    season: snap.season ?? '',
    cutoff: snap.cutoff ?? '',
    sample: snap.sample === true,
    club: snap.club,
    squad,
    coachNames: Array.isArray(snap.coachNames) ? snap.coachNames : [],
  };
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function loadClubList() {
  const base = (import.meta.env.VITE_DATA_BASE_URL ?? '').replace(/\/$/, '') || `${import.meta.env.BASE_URL}data`;
  const json = await fetchJson(`${base}/clubs.json`);
  const clubs = Array.isArray(json) ? json : json.clubs ?? [];
  return {
    clubs: clubs.filter((c) => c && c.id && c.name),
    season: json.season ?? '', cutoff: json.cutoff ?? '', sample: json.sample === true,
    source: (import.meta.env.VITE_DATA_BASE_URL ?? '') ? 'remote' : 'local',
  };
}

export async function loadClubSnapshot(clubId) {
  const base = (import.meta.env.VITE_DATA_BASE_URL ?? '').replace(/\/$/, '') || `${import.meta.env.BASE_URL}data`;
  const json = await fetchJson(`${base}/squads/${clubId}.json`);
  return normalizeSnapshot(json);
}

// Bursa pelatih: 60 kepala klub + 20 free agent (nama + umur + kewarganegaraan asli).
// Rating + harga bawaan file; harga selalu dikuantisasi ke tier 5/10-50.
import { coachPriceTier } from '../utils/format.js';

export function normalizeCoach(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  const name = String(raw.name ?? '').trim();
  if (!id || !name) return null;
  return {
    id, type: 'COACH', name,
    age: Number.isFinite(Number(raw.age)) ? Number(raw.age) : 50,
    nationality: raw.nationality ?? '',
    clubId: raw.clubId ?? '',
    clubName: raw.clubName ?? '',
    license: raw.license ?? '',
    tenureYears: Number(raw.tenureYears) || 0,
    teamValue: Number(raw.teamValue) || 0,
    rating: Math.min(99, Math.max(1, Number(raw.rating) || 75)),
    price: coachPriceTier(Number(raw.price) || 0),
    freeAgent: raw.freeAgent === true,
  };
}

export async function loadCoaches() {
  const base = (import.meta.env.VITE_DATA_BASE_URL ?? '').replace(/\/$/, '') || `${import.meta.env.BASE_URL}data`;
  const json = await fetchJson(`${base}/coaches.json`);
  const list = Array.isArray(json) ? json : json.coaches ?? [];
  const seen = new Set();
  const coaches = [];
  for (const raw of list) {
    const c = normalizeCoach(raw);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    coaches.push(c);
  }
  return coaches;
}

// Bursa transfer: seluruh pemain luar klub (satu file indeks, bukan semua snapshot).
export async function loadTargets() {
  const base = (import.meta.env.VITE_DATA_BASE_URL ?? '').replace(/\/$/, '') || `${import.meta.env.BASE_URL}data`;
  const json = await fetchJson(`${base}/targets.json`);
  const list = Array.isArray(json) ? json : json.players ?? [];
  const maxPrice = Math.max(1, ...list.map((p) => Number(p.price) || 0));
  const maxMinutes = Math.max(1, ...list.map((p) => Number(p.minutes) || 0));
  const seen = new Set();
  const players = [];
  for (const raw of list) {
    const p = normalizeSquadPlayer(raw, maxPrice, maxMinutes);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    players.push({ ...p, clubName: raw.clubName ?? '' });
  }
  return players;
}
