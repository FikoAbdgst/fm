import { useMemo } from 'react';
import tree from '../config/transferTree.json';
import { GAME } from '../config/game.js';
import { slotsFor } from '../config/formations.js';
import { ACTIONS } from '../state/actions.js';
import {
  currentTurn, historyForManager, pendingPicks,
  selectAllowedDraftActionsFor,
  selectCanReveal, selectCanFinishDraft, selectTurnProgress,
} from '../state/selectors.js';
import { validateDraftAction, validatePickAction } from '../rules/index.js';
import { buildMenuCtx, resolveMenu, advanceMenu } from '../rules/transferMenu.js';
import { detectConflicts, openingHolder, validateBid, minNextBid, round1 } from '../rules/bidding.js';
import { autoXI, randomCompose, validateCompose } from '../rules/compose.js';
import { isCompatible } from '../rules/slots.js';
import { clearSession } from '../services/storage.js';
import { coachPriceTier, formatEuro } from '../utils/format.js';
import { seededShuffle } from '../services/rng.js';
import { calcTeamRatingEntities, calcManagerScore, gradeFor } from '../utils/rating.js';

function menuCtxFor(manager, entityMap, history) {
  const soldPositions = [...new Set(manager.soldIds.map((id) => entityMap.get(id)?.position).filter(Boolean))];
  const purchases = manager.purchases ?? [];
  return buildMenuCtx({
    soldCount: manager.soldIds.length,
    keptCount: manager.slots.filter((s) => s.status === 'kept').length,
    lastDecision: [...history].reverse()[0]?.type ?? null,
    soldPositions,
    budget: manager.budget,
    initialBudget: manager.initialBudget,
    purchaseCount: purchases.length,
    lastPurchaseTier: [...purchases].reverse()[0]?.tier ?? null,
  });
}

export function useGameManager(dataset, state, dispatch) {
  const entityMap = useMemo(() => {
    const m = new Map(dataset.entityMap);
    for (const p of dataset.targets ?? []) if (!m.has(p.id)) m.set(p.id, p);
    for (const p of dataset.coaches ?? []) if (!m.has(p.id)) m.set(p.id, p);
    for (const e of Object.values(state.customEntities ?? {})) m.set(e.id, e);
    return m;
  }, [dataset.entityMap, dataset.targets, dataset.coaches, state.customEntities]);

  const managersView = useMemo(() => state.managers.map((m) => {
    const lineup = m.slots.filter((s) => s.slotId !== 'COACH')
      .map((s) => ({ slotId: s.slotId, entity: s.entityId ? entityMap.get(s.entityId) : null }));
    const coachSlot = m.slots.find((s) => s.slotId === 'COACH');
    const coach = coachSlot?.entityId ? entityMap.get(coachSlot.entityId) : null;
    const teamRating = calcTeamRatingEntities(lineup, m.formation ?? state.config.formation, coach);
    const totalSpend = (m.purchases ?? []).reduce((a, p) => a + p.price, 0);
    const score = calcManagerScore({
      teamRating, baselineRating: m.baselineRating ?? teamRating, totalSpend,
      budgetLeft: m.budget, initialBudget: m.initialBudget,
      penalties: m.penalties ?? 0, modifierCount: state.config.modifiers.length,
    });
    const filled = m.slots.filter((s) => s.entityId).length;
    let activeMenu = null;
    if (state.config.modifiers.includes('TRANSFER_MENU') && m.menu?.ctx) {
      try { activeMenu = resolveMenu(tree, m.menu.ctx, m.menu.nodeId ?? tree.root); } catch { activeMenu = null; }
    }
    return { ...m, lineup, coach, teamRating, score, grade: gradeFor(score), totalSpend, filled, activeMenu };
  }), [state.managers, state.config, entityMap]);

  // Urutan tampil = urutan pendaftaran (netral; rating disembunyikan).
  const comparison = useMemo(() => managersView
    .map((m, i) => ({ order: i + 1, managerId: m.id, name: m.name, color: m.color, teamRating: m.teamRating, score: m.score, budget: m.budget, grade: m.grade })),
  [managersView]);

  const actions = useMemo(() => ({
    startCompose({ managers, config }) {
      if (!managers?.length || managers.length > 3) return { ok: false, message: 'Jumlah manager 1-3.' };
      if (!config.clubId || !dataset.clubs.some((c) => c.id === config.clubId)) return { ok: false, message: 'Pilih klub yang valid.' };
      for (const m of managers) {
        if (!m.name || m.name.trim().length < 2 || m.name.trim().length > 24) return { ok: false, message: `Nama manager ${m.name || '?'} 2-24 karakter.` };
      }
      // MVP selalu santai: tanpa modifier (diparkir di PRD sebagai tantangan lanjutan).
      const seed = Math.floor(Math.random() * 1_000_000);
      const now = Date.now();
      const formation = config.formation ?? GAME.formationDefault;
      const built = managers.map((m, i) => ({
        id: `m${i + 1}`,
        name: m.name.trim(),
        color: GAME.managerColors[i % GAME.managerColors.length],
        clubId: config.clubId,
        formation,
        initialBudget: config.budgetOverrides?.[`m${i + 1}`] ?? m.budget ?? config.initialBudget ?? GAME.budgetDefault,
        budget: config.budgetOverrides?.[`m${i + 1}`] ?? m.budget ?? config.initialBudget ?? GAME.budgetDefault,
        slots: [], soldIds: [], purchases: [],
        menu: { nodeId: null, ctx: null }, penalties: 0, baselineRating: 0,
      }));
      dispatch({
        type: ACTIONS.COMPOSE_STARTED,
        payload: {
          state: {
            schemaVersion: GAME.schemaVersion,
            sessionId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
            seed, phase: 'COMPOSE',
            config: {
              clubId: config.clubId, managerCount: built.length,
              mode: 'CASUAL', modifiers: [],
              formation, initialBudget: config.initialBudget ?? GAME.budgetDefault,
              budgetOverrides: config.budgetOverrides ?? {},
              decisionMode: 'SEQUENTIAL',
              infoMode: 'OPEN',
              sellFactor: GAME.sellFactor,
              sellFactorEnabled: false,
            },
            compose: { slots: {}, coach: null, locked: false },
            customEntities: {}, managers: built,
            turns: [], currentTurnIndex: 0,
            eventLog: [{ n: 1, type: 'COMPOSE_STARTED', at: now }],
            eventSeq: 1, overrides: [],
            createdAt: now, updatedAt: now,
          },
        },
      });
      return { ok: true };
    },

    autofillCompose() {
      const mode = 'RANDOM';
      const squad = dataset.players;
      const external = dataset.targets ?? [];
      const clubId = state.config.clubId;
      const defs = slotsFor(state.config.formation);
      // Starter kunci menit terbanyak (stabil tiap klik); yang diundi ulang
      // tiap klik hanya bursanya, lewat seed segar.
      const { starters } = autoXI(squad, defs);
      const drawId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
      const r = randomCompose(squad, external, defs, clubId, `${state.seed}:compose:${drawId}`, starters);
      const candidates = r.candidates;
      const slots = {};
      for (const def of defs) {
        if (def.slotId === 'COACH') continue;
        slots[def.slotId] = { starterId: starters[def.slotId] ?? null, candidateIds: candidates[def.slotId] ?? [], mode };
      }
      // Pelatih starter = pelatih kepala klub sendiri (fix, dari bursa).
      // Kandidat = 3 undian ber-seed luar klub.
      const ownCoach = (dataset.coaches ?? []).find((c) => c.clubId === state.config.clubId) ?? null;
      const outside = (dataset.coaches ?? []).filter((c) => c.clubId !== state.config.clubId);
      const customEntities = { ...state.customEntities };
      let coachStarterId = ownCoach?.id ?? null;
      if (!coachStarterId) {
        // Darurat (klub tanpa data pelatih): satu entri fix dari nama snapshot.
        const fallbackName = dataset.snapshot?.coachNames?.[0] ?? 'Pelatih Kepala';
        coachStarterId = `tm_h_custom_${Date.now().toString(36)}_0`;
        customEntities[coachStarterId] = {
          id: coachStarterId, type: 'COACH', name: fallbackName,
          clubId: state.config.clubId, rating: 78, price: 5, manual: true,
        };
      }
      // Kandidat pelatih: 3 dari luar klub, selalu urut termurah dulu
      // (pilihan 1 rendah, 3 tinggi). Undian tiap klik lewat seed segar.
      const coachCandIds = seededShuffle(outside, `${state.seed}:coach:${drawId}`)
        .slice(0, 3)
        .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
        .map((c) => c.id);
      dispatch({
        type: ACTIONS.COMPOSE_AUTOFILLED,
        payload: {
          compose: { slots, coach: { starterId: coachStarterId, candidateIds: coachCandIds, mode: 'AUTO' }, locked: false },
          customEntities,
        },
      });
      return { ok: true };
    },

    setStarter(slotId, entityId) {
      const defs = slotsFor(state.config.formation);
      const group = defs.find((d) => d.slotId === slotId)?.group;
      if (group && entityId) {
        for (const [sid, s] of Object.entries(state.compose.slots)) {
          if (sid === slotId) continue;
          const sdef = defs.find((d) => d.slotId === sid);
          if (sdef?.group !== group) continue;
          if (s?.starterId === entityId) {
            return { ok: false, message: `${entityMap.get(entityId)?.name ?? entityId} sudah jadi starter ${sid} di posisi ${group}.` };
          }
          if ((s?.candidateIds ?? []).includes(entityId)) {
            return { ok: false, message: `${entityMap.get(entityId)?.name ?? entityId} sudah ada di bursa ${sid} (posisi ${group}).` };
          }
        }
      }
      const compose = {
        ...state.compose,
        slots: { ...state.compose.slots, [slotId]: { ...(state.compose.slots[slotId] ?? { candidateIds: [], mode: 'MANUAL' }), starterId: entityId, mode: 'MANUAL' } },
      };
      dispatch({ type: ACTIONS.STARTER_SET, payload: { compose } });
      return { ok: true };
    },

    setCandidates(slotId, ids) {
      if (!Array.isArray(ids) || ids.length !== 3) return { ok: false, message: 'Kandidat harus tepat 3.' };
      const slot = state.compose.slots[slotId];
      if (ids.includes(slot?.starterId)) return { ok: false, message: 'Kandidat tidak boleh sama dengan starter.' };
      if (new Set(ids).size !== 3) return { ok: false, message: 'Kandidat duplikat.' };
      const outsider = ids.find((id) => entityMap.get(id)?.clubId === state.config.clubId);
      if (outsider) return { ok: false, message: `${entityMap.get(outsider)?.name} satu klub, kandidat harus dari luar klub.` };
      const defs = slotsFor(state.config.formation);
      const group = defs.find((d) => d.slotId === slotId)?.group;
      if (group) {
        for (const [sid, s] of Object.entries(state.compose.slots)) {
          if (sid === slotId) continue;
          const sdef = defs.find((d) => d.slotId === sid);
          if (sdef?.group !== group) continue;
          const clash = ids.find((id) => id === s?.starterId || (s?.candidateIds ?? []).includes(id));
          if (clash) {
            return { ok: false, message: `${entityMap.get(clash)?.name ?? clash} sudah dipakai di ${s?.starterId === clash ? `starter ${sid}` : `bursa ${sid}`} (posisi ${group}).` };
          }
        }
      }
      const compose = {
        ...state.compose,
        slots: { ...state.compose.slots, [slotId]: { ...(slot ?? { starterId: null }), candidateIds: ids, mode: 'MANUAL' } },
      };
      dispatch({ type: ACTIONS.CANDIDATES_SET, payload: { compose } });
      return { ok: true };
    },

    setCoach({ starterId, starterName, candidateIds, manualCandidates }) {
      // Starter fix = id pelatih klub sendiri; kandidat = id pool luar klub.
      // Nama manual (di luar pool) jadi entri custom dengan rating + harga isi moderator.
      const customEntities = { ...state.customEntities };
      const mkManual = (name, rating, price) => {
        const id = `tm_h_custom_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
        customEntities[id] = {
          id, type: 'COACH', name: String(name).trim(), clubId: state.config.clubId,
          rating: Math.min(99, Math.max(1, Number(rating) || 75)),
          price: price === undefined || price === null || price === '' ? coachPriceTier(0) : Math.max(0, Math.round(Number(price) * 10) / 10),
          manual: true,
        };
        return id;
      };
      let sid = starterId && entityMap.get(starterId) ? starterId : null;
      if (!sid && starterName?.trim()) sid = mkManual(starterName);
      if (!sid) return { ok: false, message: 'Starter pelatih belum ditentukan.' };
      const resolved = [];
      for (const c of candidateIds ?? []) {
        if (typeof c === 'string' && entityMap.get(c)) { resolved.push(c); continue; }
        if (typeof c === 'object' && c?.name?.trim()) resolved.push(mkManual(c.name, c.rating, c.price));
      }
      for (const n of manualCandidates ?? []) {
        if (typeof n === 'object' && n?.name?.trim()) resolved.push(mkManual(n.name, n.rating, n.price));
        else if (String(n).trim()) resolved.push(mkManual(n));
      }
      const uniq = [...new Set(resolved)].slice(0, 3);
      if (uniq.length !== 3) return { ok: false, message: 'Kandidat pelatih harus tepat 3.' };
      if (uniq.includes(sid)) return { ok: false, message: 'Kandidat tidak boleh sama dengan starter.' };
      const ownClub = state.config.clubId;
      const insider = uniq.find((id) => { const e = entityMap.get(id); return e && !e.manual && e.clubId === ownClub; });
      if (insider) return { ok: false, message: `${entityMap.get(insider)?.name} satu klub, kandidat harus dari luar klub.` };
      dispatch({
        type: ACTIONS.COACH_SET,
        payload: { compose: { ...state.compose, coach: { starterId: sid, candidateIds: uniq, mode: 'MANUAL' } }, customEntities },
      });
      return { ok: true };
    },

    startDraft() {
      const defs = slotsFor(state.config.formation);
      const errors = validateCompose(state.compose, defs, entityMap, state.config.clubId);
      if (!state.compose.coach?.starterId || (state.compose.coach?.candidateIds ?? []).length !== 3) {
        errors.push('Pelatih + 3 kandidatnya wajib diisi.');
      }
      if (errors.length) return { ok: false, message: errors[0] };
      const managers = state.managers.map((m) => {
        const slots = defs.map((def) => {
          const entityId = def.slotId === 'COACH' ? state.compose.coach.starterId : state.compose.slots[def.slotId].starterId;
          return { slotId: def.slotId, entityId, status: 'pending', soldEntityId: null };
        });
        const lineup = slots.filter((s) => s.slotId !== 'COACH').map((s) => ({ slotId: s.slotId, entity: entityMap.get(s.entityId) }));
        const coach = entityMap.get(state.compose.coach.starterId);
        return { ...m, slots, baselineRating: calcTeamRatingEntities(lineup, m.formation, coach), menu: { nodeId: null, ctx: null } };
      });
      // Menu awal per manager (soldCount 0).
      for (const m of managers) {
        const ctx = menuCtxFor(m, entityMap, []);
        let nodeId = null;
        if (state.config.modifiers.includes('TRANSFER_MENU')) {
          try { nodeId = resolveMenu(tree, ctx, tree.root).nodeId; } catch { nodeId = null; }
        }
        m.menu = { nodeId, ctx };
      }
      const order = defs.map((d) => d.slotId);
      const turns = order.map((slotId) => ({ slotId, status: 'SEALED', decisions: {}, picks: {}, claims: [], absent: [] }));
      const now = Date.now();
      dispatch({
        type: ACTIONS.GAME_STARTED,
        payload: {
          state: {
            ...state, phase: 'DRAFT', managers,
            compose: { ...state.compose, locked: true },
            turns, currentTurnIndex: 0,
            eventLog: [...state.eventLog, { n: state.eventSeq + 1, type: 'GAME_STARTED', at: now }],
            eventSeq: state.eventSeq + 1, updatedAt: now,
          },
        },
      });
      return { ok: true };
    },

    decide(managerId, decision) {
      const turn = currentTurn(state);
      if (!turn || turn.status !== 'SEALED') return { ok: false, message: 'Turn tidak sedang dibuka.' };
      if ((turn.absent ?? []).includes(managerId)) return { ok: false, message: 'Manager absen pada turn ini.' };
      const v = validateDraftAction({ config: state.config, history: historyForManager(state, managerId), nextAction: { type: decision } });
      if (!v.ok) return v;
      dispatch({ type: ACTIONS.TURN_DECIDED, payload: { managerId, decision } });
      return { ok: true };
    },

    markAbsent(managerId) {
      dispatch({ type: ACTIONS.ABSENT_MARKED, payload: { managerId } });
      return { ok: true };
    },

    revealTurn() {
      const turn = currentTurn(state);
      if (!turn || turn.status !== 'SEALED') return { ok: false, message: 'Tidak ada turn sealed.' };
      // Yang belum input dianggap absen (default Keep).
      const missing = state.managers.filter((m) => !turn.decisions[m.id] && !(turn.absent ?? []).includes(m.id));
      for (const m of missing) dispatch({ type: ACTIONS.ABSENT_MARKED, payload: { managerId: m.id } });
      const credits = {};
      for (const m of state.managers) {
        const d = turn.decisions[m.id] ?? 'KEEP';
        if (d !== 'SELL') continue;
        // Jual menambah budget sebesar harga pasar penuh starter yang dilepas.
        const slot = m.slots.find((s) => s.slotId === turn.slotId);
        const ent = slot?.entityId ? entityMap.get(slot.entityId) : null;
        credits[m.id] = ent ? Math.round(ent.price * 10) / 10 : 0;
      }
      dispatch({ type: ACTIONS.TURN_REVEALED, payload: { credits } });
      // Perbarui menu tiap manager (purchases/sold berubah).
      for (const m of state.managers) {
        if (!state.config.modifiers.includes('TRANSFER_MENU')) continue;
        const ctx = menuCtxFor(m, entityMap, historyForManager(state, m.id));
        try {
          const nodeId = resolveMenu(tree, ctx, m.menu?.nodeId ?? tree.root).nodeId;
          dispatch({ type: ACTIONS.MENU_SET, payload: { managerId: m.id, nodeId, ctx } });
        } catch { /* abaikan */ }
      }
      return { ok: true };
    },

    pick(managerId, candidateId) {
      const turn = currentTurn(state);
      if (!turn || turn.status !== 'REVEALED') return { ok: false, message: 'Belum reveal.' };
      if (turn.decisions?.[managerId] !== 'SELL') return { ok: false, message: 'Hanya yang Sell yang pick.' };
      if (turn.picks?.[managerId]) return { ok: false, message: 'Sudah pick.' };
      if ((turn.claims ?? []).some((c) => c.managerId === managerId)) return { ok: false, message: 'Sudah klaim, tunggu penyelesaian.' };
      const mgr = state.managers.find((m) => m.id === managerId);
      const slotCompose = turn.slotId === 'COACH' ? state.compose.coach : state.compose.slots[turn.slotId];
      const slotCands = slotCompose?.candidateIds ?? [];
      if (!slotCands.includes(candidateId)) return { ok: false, ruleId: 'SLOT', message: 'Kandidat bukan milik slot ini.', overridable: false };
      // Target yang sudah dimenangkan manager lain tidak bisa diklaim lagi.
      const settledOwner = Object.entries(turn.picks ?? []).find(([, p]) => p?.candidateId === candidateId)?.[0];
      if (settledOwner && settledOwner !== managerId) {
        const nm = state.managers.find((m) => m.id === settledOwner)?.name ?? 'manager lain';
        return { ok: false, ruleId: 'SLOT', message: `${entityMap.get(candidateId)?.name ?? 'Target'} sudah dimenangkan ${nm}, pilih lain.`, overridable: false };
      }
      if (state.auction && state.auction.targetId === candidateId) {
        return { ok: false, ruleId: 'SLOT', message: 'Target sedang dilelang, tunggu SOLD.', overridable: false };
      }
      const cand = entityMap.get(candidateId);
      if (!cand) return { ok: false, message: 'Kandidat tidak ditemukan.' };
      const slotDefs = slotsFor(mgr.formation ?? state.config.formation);
      const slotDef = slotDefs.find((d) => d.slotId === turn.slotId);
      if (!isCompatible(cand, slotDef).ok) {
        return { ok: false, ruleId: 'SLOT', message: 'Kandidat tak kompatibel dengan slot (terkunci).', overridable: false };
      }
      {
        const ctx = menuCtxFor(mgr, entityMap, historyForManager(state, managerId));
        const v = validatePickAction({ config: state.config, tree, menuCtx: ctx, menuNodeId: mgr.menu?.nodeId, candidate: cand, budgetAfterCredit: mgr.budget });
        if (!v.ok) return v;
      }
      if (mgr.budget < cand.price - 1e-9) {
        dispatch({ type: ACTIONS.PICK_EMPTY, payload: { managerId } });
        return { ok: true, outcome: 'EMPTY' };
      }
      dispatch({ type: ACTIONS.CLAIM_ADDED, payload: { managerId, candidateId } });
      const rivals = (turn.claims ?? []).filter((c) => c.candidateId === candidateId && c.managerId !== managerId);
      if (rivals.length) {
        return { ok: true, outcome: 'CONTESTED', message: `Rebutan! ${cand.name} masuk antrean lelang.` };
      }
      return { ok: true, outcome: 'CLAIMED', price: cand.price };
    },

    withdrawClaim(managerId) {
      dispatch({ type: ACTIONS.CLAIM_REMOVED, payload: { managerId } });
      return { ok: true };
    },

    // Selesaikan semua klaim turn ini: yang tak rebutan langsung dibeli di
    // harga dasar; yang rebutan masuk lelang (buka yang pertama).
    settlePicks() {
      const turn = currentTurn(state);
      if (!turn || turn.status !== 'REVEALED') return { ok: false, message: 'Belum reveal.' };
      if (state.auction) return { ok: false, message: 'Selesaikan lelang yang berjalan dulu.' };
      const { uncontested, contested } = detectConflicts(turn.claims ?? []);
      for (const u of uncontested) {
        const c = u.claims[0];
        const mgr = state.managers.find((m) => m.id === c.managerId);
        const target = entityMap.get(c.candidateId);
        if (!mgr || !target) continue;
        if (mgr.budget < target.price - 1e-9) {
          dispatch({ type: ACTIONS.PICK_EMPTY, payload: { managerId: c.managerId } });
          continue;
        }
        dispatch({ type: ACTIONS.PICK_MADE, payload: { managerId: c.managerId, candidateId: target.id, price: target.price, candidate: target } });
      }
      if (!contested.length) return { ok: true, uncontested: uncontested.length, contested: 0 };
      const first = contested[0];
      return actions.openAuction(first.targetId);
    },

    openAuction(targetId) {
      const turn = currentTurn(state);
      if (!turn) return { ok: false, message: 'Tidak ada turn aktif.' };
      if (state.auction) return { ok: false, message: 'Selesaikan lelang yang berjalan dulu.' };
      const claims = (turn.claims ?? []).filter((c) => c.candidateId === targetId);
      if (claims.length < 2) return { ok: false, message: 'Butuh ≥ 2 pengklaim untuk lelang.' };
      const holder = openingHolder(claims);
      const target = entityMap.get(targetId);
      if (!target) return { ok: false, message: 'Target tidak ditemukan.' };
      const base = round1(target.price);
      dispatch({
        type: ACTIONS.AUCTION_OPENED,
        payload: {
          auction: {
            targetId, slotId: turn.slotId, status: 'OPEN',
            basePrice: base, currentBid: base, leaderId: holder.managerId,
            eligible: claims.map((c) => c.managerId),
            bids: [],
          },
        },
      });
      const holderName = state.managers.find((m) => m.id === holder.managerId)?.name ?? '';
      return { ok: true, message: `Lelang dibuka. ${holderName} memegang ${formatEuro(base)}.` };
    },

    placeBid(managerId, amount) {
      const auction = state.auction;
      if (!auction) return { ok: false, message: 'Tidak ada lelang aktif.' };
      const mgr = state.managers.find((m) => m.id === managerId);
      if (!mgr) return { ok: false, message: 'Manager tidak ditemukan.' };
      const amt = amount ?? minNextBid(auction.currentBid);
      const v = validateBid({ auction, managerId, amount: amt, budget: mgr.budget });
      if (!v.ok) return v;
      dispatch({ type: ACTIONS.BID_PLACED, payload: { managerId, amount: amt, at: Date.now() } });
      return { ok: true, amount: amt };
    },

    withdrawBid(managerId) {
      const auction = state.auction;
      if (!auction) return { ok: false, message: 'Tidak ada lelang aktif.' };
      if (!auction.eligible.includes(managerId)) return { ok: false, message: 'Manager tidak ikut lelang ini.' };
      const eligible = auction.eligible.filter((id) => id !== managerId);
      dispatch({ type: ACTIONS.AUCTION_WITHDRAWN, payload: { managerId } });
      if (eligible.length === 1) {
        return actions.settleAuction();
      }
      if (!eligible.length) {
        dispatch({ type: ACTIONS.AUCTION_OPENED, payload: { auction: null } });
        return { ok: true, message: 'Semua mundur, lelang batal. Klaim ulang.' };
      }
      return { ok: true, message: 'Mundur dari lelang.' };
    },

    settleAuction() {
      const auction = state.auction;
      if (!auction) return { ok: false, message: 'Tidak ada lelang aktif.' };
      const turn = currentTurn(state);
      const eligible = auction.eligible ?? [];
      // Pemenang = leader terakhir yang masih ikut dan cukup budget.
      const ordered = [...(auction.bids ?? [])].reverse();
      const tried = new Set();
      let winnerId = eligible.includes(auction.leaderId) ? auction.leaderId : null;
      let price = auction.currentBid;
      const affordable = (id, amt) => (state.managers.find((m) => m.id === id)?.budget ?? 0) >= amt - 1e-9;
      if (!winnerId || !affordable(winnerId, price)) {
        winnerId = null;
        for (const b of ordered) {
          if (tried.has(b.managerId) || b.withdraw) continue;
          tried.add(b.managerId);
          if (!eligible.includes(b.managerId)) continue;
          if (affordable(b.managerId, b.amount)) { winnerId = b.managerId; price = b.amount; break; }
        }
        if (!winnerId && eligible.length === 1 && affordable(eligible[0], auction.currentBid)) {
          winnerId = eligible[0];
          price = auction.currentBid;
        }
      }
      const target = entityMap.get(auction.targetId);
      if (!winnerId || !target) {
        dispatch({ type: ACTIONS.AUCTION_OPENED, payload: { auction: null } });
        return { ok: false, message: 'Lelang batal (budget tak cukup), semua klaim ulang.' };
      }
      dispatch({ type: ACTIONS.AUCTION_SETTLED, payload: { winnerId, price, targetId: auction.targetId, candidate: target } });
      // Pecundang klaim ulang (klaim target ini sudah dihapus reducer).
      // Buka lelang berikutnya bila masih ada konflik lain di turn ini.
      const leftover = (turn.claims ?? []).filter((c) => c.candidateId !== auction.targetId);
      const again = detectConflicts(leftover);
      if (again.contested.length) {
        const nxt = actions.openAuction(again.contested[0].targetId);
        return { ...nxt, winnerId, price };
      }
      const winnerName = state.managers.find((m) => m.id === winnerId)?.name ?? '';
      return { ok: true, winnerId, price, message: `SOLD. ${winnerName} menang ${formatEuro(price)}.` };
    },

    nextTurn() {
      const left = pendingPicks(state);
      if (left.length) return { ok: false, message: `${left.length} manager belum pick.` };
      if (state.auction) return { ok: false, message: 'Selesaikan lelang yang berjalan dulu.' };
      const turn = currentTurn(state);
      const open = detectConflicts(turn?.claims ?? []);
      if (open.contested.length) return { ok: false, message: `${open.contested.length} rebutan belum dilelang. Buka lelang dulu.` };
      if (state.currentTurnIndex + 1 >= state.turns.length) {
        dispatch({ type: ACTIONS.PHASE_ADVANCED, payload: { phase: 'REVIEW' } });
      } else {
        dispatch({ type: ACTIONS.PHASE_ADVANCED, payload: { phase: 'DRAFT', patch: { currentTurnIndex: state.currentTurnIndex + 1 } } });
      }
      return { ok: true };
    },

    undo() {
      if (!state._past?.length) return { ok: false, message: 'Tidak ada aksi untuk diurungkan.' };
      dispatch({ type: ACTIONS.EVENT_UNDONE });
      return { ok: true };
    },

    resetGame() {
      clearSession();
      dispatch({ type: ACTIONS.GAME_RESET });
    },
  }), [state, dispatch, dataset, entityMap]);

  const turn = currentTurn(state);
  const conflicts = turn ? detectConflicts(turn.claims ?? []).contested : [];
  return {
    state,
    derived: {
      managersView, comparison, entityMap,
      turn,
      auction: state.auction ?? null,
      conflicts,
      allowedDraftActions: (managerId) => selectAllowedDraftActionsFor(state, managerId),
      progress: selectTurnProgress(state),
      canReveal: selectCanReveal(state),
      pendingPickCount: pendingPicks(state).length,
      canFinishDraft: selectCanFinishDraft(state),
    },
    actions, dataset,
  };
}
