import { ACTIONS } from './actions.js';
import { blankState } from './initialState.js';

function snapshotOf(state) {
  const { _past, ...rest } = state;
  return JSON.parse(JSON.stringify(rest));
}

function withHistory(state, next, event) {
  const past = [...(state._past ?? []), snapshotOf(state)].slice(-60);
  const log = event
    ? [...(next.eventLog ?? state.eventLog ?? []), { n: (state.eventSeq ?? 0) + 1, at: Date.now(), ...event }]
    : (next.eventLog ?? state.eventLog);
  return {
    ...state, ...next,
    eventLog: log,
    eventSeq: event ? (state.eventSeq ?? 0) + 1 : state.eventSeq,
    updatedAt: Date.now(),
    _past: past,
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SESSION_CONFIGURED: {
      return withHistory(state, { config: { ...state.config, ...action.payload.config } }, null);
    }
    case ACTIONS.COMPOSE_STARTED: {
      return withHistory(state, { ...action.payload.state }, { type: 'COMPOSE_STARTED' });
    }
    case ACTIONS.COMPOSE_AUTOFILLED:
    case ACTIONS.STARTER_SET:
    case ACTIONS.CANDIDATES_SET:
    case ACTIONS.COACH_SET: {
      return withHistory(state, {
        compose: action.payload.compose,
        ...(action.payload.customEntities ? { customEntities: action.payload.customEntities } : {}),
      }, { type: action.type.replace('COMPOSE_', '').replace(/_/g, ' '), undoable: true });
    }
    case ACTIONS.GAME_STARTED: {
      const fresh = { ...action.payload.state };
      return { ...fresh, _past: [], eventLog: fresh.eventLog ?? [], eventSeq: fresh.eventSeq ?? 0 };
    }
    case ACTIONS.TURN_DECIDED: {
      const { managerId, decision } = action.payload;
      const turns = state.turns.map((t, i) => (
        i === state.currentTurnIndex ? { ...t, decisions: { ...t.decisions, [managerId]: decision } } : t
      ));
      return withHistory(state, { turns }, { type: decision, managerId, undoable: true });
    }
    case ACTIONS.ABSENT_MARKED: {
      const { managerId } = action.payload;
      const turns = state.turns.map((t, i) => (
        i === state.currentTurnIndex
          ? { ...t, absent: [...(t.absent ?? []), managerId], decisions: { ...t.decisions, [managerId]: 'KEEP' } }
          : t
      ));
      return withHistory(state, { turns }, { type: 'ABSENT', managerId, undoable: true });
    }
    case ACTIONS.TURN_REVEALED: {
      // Terapkan keputusan sealed ke slot tiap manager.
      const turn = state.turns[state.currentTurnIndex];
      if (!turn || turn.status === 'REVEALED') return state;
      const managers = state.managers.map((m) => {
        const decision = turn.decisions[m.id] ?? 'KEEP';
        const slots = m.slots.map((s) => {
          if (s.slotId !== turn.slotId) return s;
          if (decision === 'KEEP') return { ...s, status: 'kept' };
          return { ...s, status: 'sold', entityId: null, soldEntityId: s.entityId };
        });
        const soldSlot = m.slots.find((s) => s.slotId === turn.slotId);
        const credit = decision === 'SELL' ? (action.payload.credits?.[m.id] ?? 0) : 0;
        return {
          ...m,
          budget: decision === 'SELL' ? Math.round((m.budget + credit) * 10) / 10 : m.budget,
          slots,
          soldIds: decision === 'SELL' && soldSlot?.entityId ? [...m.soldIds, soldSlot.entityId] : m.soldIds,
        };
      });
      const turns = state.turns.map((t, i) => (i === state.currentTurnIndex ? { ...t, status: 'REVEALED' } : t));
      return withHistory(state, { managers, turns }, { type: 'REVEALED', payload: { slotId: turn.slotId }, undoable: true });
    }
    case ACTIONS.CLAIM_ADDED: {
      const { managerId, candidateId } = action.payload;
      const turns = state.turns.map((t, i) => {
        if (i !== state.currentTurnIndex) return t;
        const claims = [...(t.claims ?? [])].filter((c) => c.managerId !== managerId);
        claims.push({ managerId, candidateId, at: Date.now() });
        return { ...t, claims };
      });
      return withHistory(state, { turns }, { type: 'CLAIM', managerId, entityId: candidateId, undoable: true });
    }
    case ACTIONS.CLAIM_REMOVED: {
      const { managerId } = action.payload;
      const turns = state.turns.map((t, i) => (
        i === state.currentTurnIndex ? { ...t, claims: (t.claims ?? []).filter((c) => c.managerId !== managerId) } : t
      ));
      return withHistory(state, { turns }, { type: 'CLAIM_WITHDRAWN', managerId, undoable: true });
    }
    case ACTIONS.AUCTION_OPENED: {
      return withHistory(state, { auction: action.payload.auction }, { type: 'AUCTION_OPENED', entityId: action.payload.auction.targetId });
    }
    case ACTIONS.BID_PLACED: {
      if (!state.auction) return state;
      const { managerId, amount, at } = action.payload;
      const bids = [...(state.auction.bids ?? []), { managerId, amount, at, seq: (state.auction.bids ?? []).length + 1 }];
      const auction = { ...state.auction, currentBid: amount, leaderId: managerId, bids };
      return withHistory(state, { auction }, { type: 'BID', managerId, entityId: state.auction.targetId, payload: { amount }, undoable: true });
    }
    case ACTIONS.AUCTION_WITHDRAWN: {
      if (!state.auction) return state;
      const { managerId } = action.payload;
      const eligible = (state.auction.eligible ?? []).filter((id) => id !== managerId);
      const bids = [...(state.auction.bids ?? []), { managerId, amount: null, at: Date.now(), seq: (state.auction.bids ?? []).length + 1, withdraw: true }];
      return withHistory(state, { auction: { ...state.auction, eligible, bids } }, { type: 'AUCTION_PASS', managerId, entityId: state.auction.targetId, undoable: true });
    }
    case ACTIONS.AUCTION_SETTLED: {
      const { winnerId, price, targetId } = action.payload;
      const turn = state.turns[state.currentTurnIndex];
      const now = Date.now();
      const winner = state.managers.find((m) => m.id === winnerId);
      const slotEntry = winner?.slots.find((s) => s.slotId === turn.slotId);
      if (!winner || !slotEntry) return state;
      const managers = state.managers.map((m) => {
        if (m.id !== winnerId) return m;
        const slots = m.slots.map((s) => (s.slotId === turn.slotId ? { ...s, entityId: targetId, status: 'bought' } : s));
        const cand = action.payload.candidate ?? null;
        const purchases = [...(m.purchases ?? []), {
          entityId: targetId, price, via: 'BID_WON', slotId: turn.slotId, at: now,
          position: cand?.position ?? 'MID', rating: cand?.rating ?? 0, tier: cand?.tier ?? 'FILLER',
        }];
        return { ...m, budget: Math.round((m.budget - price) * 10) / 10, slots, purchases };
      });
      const turns = state.turns.map((t, i) => (
        i === state.currentTurnIndex
          ? {
            ...t,
            picks: { ...t.picks, [winnerId]: { candidateId: targetId, via: 'BID_WON' } },
            claims: (t.claims ?? []).filter((c) => c.candidateId !== targetId),
          }
          : t
      ));
      return withHistory(state, { managers, turns, auction: null },
        { type: 'AUCTION_SETTLED', managerId: winnerId, entityId: targetId, payload: { price }, undoable: true });
    }
    case ACTIONS.PICK_MADE: {
      const { managerId, candidateId, price } = action.payload;
      const turn = state.turns[state.currentTurnIndex];
      const now = Date.now();
      const managers = state.managers.map((m) => {
        if (m.id !== managerId) return m;
        const slots = m.slots.map((s) => (s.slotId === turn.slotId ? { ...s, entityId: candidateId, status: 'bought' } : s));
        const cand = action.payload.candidate ?? null;
        const purchases = [...(m.purchases ?? []), {
          entityId: candidateId, price, via: 'PICK', slotId: turn.slotId, at: now,
          position: cand?.position ?? 'MID', rating: cand?.rating ?? 0, tier: cand?.tier ?? 'FILLER',
        }];
        return { ...m, budget: Math.round((m.budget - price) * 10) / 10, slots, purchases };
      });
      const turns = state.turns.map((t, i) => (
        i === state.currentTurnIndex
          ? { ...t, picks: { ...t.picks, [managerId]: { candidateId, ranking: action.payload.ranking ?? null } }, claims: (t.claims ?? []).filter((c) => c.managerId !== managerId) }
          : t
      ));
      return withHistory(state, { managers, turns }, { type: 'PICK', managerId, entityId: candidateId, payload: { price }, undoable: true });
    }
    case ACTIONS.PICK_EMPTY: {
      const { managerId } = action.payload;
      const turn = state.turns[state.currentTurnIndex];
      const managers = state.managers.map((m) => {
        if (m.id !== managerId) return m;
        const slots = m.slots.map((s) => (s.slotId === turn.slotId ? { ...s, status: 'empty' } : s));
        return { ...m, slots, penalties: (m.penalties ?? 0) + 1 };
      });
      const turns = state.turns.map((t, i) => (
        i === state.currentTurnIndex ? { ...t, picks: { ...t.picks, [managerId]: { candidateId: null } }, claims: (t.claims ?? []).filter((c) => c.managerId !== managerId) } : t
      ));
      return withHistory(state, { managers, turns }, { type: 'PICK_EMPTY', managerId, undoable: true });
    }
    case ACTIONS.MENU_SET: {
      const { managerId, nodeId, ctx } = action.payload;
      const managers = state.managers.map((m) => (m.id === managerId ? { ...m, menu: { nodeId, ctx } } : m));
      return { ...state, managers, updatedAt: Date.now() };
    }
    case ACTIONS.PENALTY_ADDED: {
      const { managerId, points } = action.payload;
      const managers = state.managers.map((m) => (m.id === managerId ? { ...m, penalties: (m.penalties ?? 0) + points } : m));
      return withHistory(state, { managers }, { type: 'PENALTY', managerId, payload: { points } });
    }
    case ACTIONS.OVERRIDE_APPLIED: {
      const entry = { ...action.payload, at: Date.now() };
      return withHistory(state, { overrides: [...(state.overrides ?? []), entry] }, { type: 'OVERRIDE', payload: entry });
    }
    case ACTIONS.EVENT_UNDONE: {
      const past = [...(state._past ?? [])];
      const prev = past.pop();
      if (!prev) return state;
      return { ...prev, _past: past, updatedAt: Date.now() };
    }
    case ACTIONS.PHASE_ADVANCED: {
      return withHistory(state, {
        phase: action.payload.phase,
        ...(action.payload.patch ?? {}),
        ...(action.payload.phase === 'DRAFT' && action.payload.nextTurn != null ? { currentTurnIndex: action.payload.nextTurn } : {}),
      }, { type: 'PHASE', payload: { phase: action.payload.phase } });
    }
    case ACTIONS.GAME_RESET: {
      return blankState();
    }
    case ACTIONS.STATE_HYDRATED: {
      return { ...action.payload.state, _past: [] };
    }
    default:
      return state;
  }
}
