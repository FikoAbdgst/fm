import { evalCondition } from './expression.js';

export function buildMenuCtx({ soldCount, keptCount, lastDecision, soldPositions, budget, initialBudget, purchaseCount, lastPurchaseTier }) {
  return {
    soldCount,
    keptCount,
    lastDecision,
    soldPositions: [...soldPositions],
    budgetRatio: initialBudget > 0 ? budget / initialBudget : 0,
    purchaseCount,
    lastPurchaseTier,
  };
}

export function resolveMenu(tree, ctx, currentNodeId) {
  let id = currentNodeId ?? tree.root;
  let node = tree.nodes[id];
  let guard = 0;
  while (node && node.type === 'branch') {
    if (guard++ > 10) throw new Error('Logic tree berputar, periksa konfigurasi.');
    const hit = node.branches.find((b) => evalCondition(b.if, ctx));
    if (!hit) throw new Error('Logic tree tidak lengkap: tidak ada cabang yang cocok.');
    id = hit.next;
    node = tree.nodes[id];
  }
  if (!node) throw new Error('Menu tidak ditemukan di logic tree.');
  return { nodeId: id, menu: node };
}

export function matchesFilter(player, filter = {}, ctx = {}) {
  if (filter.minRating != null && player.rating < filter.minRating) return false;
  if (filter.maxRating != null && player.rating > filter.maxRating) return false;
  if (Array.isArray(filter.tiers) && !filter.tiers.includes(player.tier)) return false;
  if (Array.isArray(filter.positions) && !filter.positions.includes(player.position)) return false;
  if (filter.anyOf) {
    const pass = filter.anyOf.some((cond) => {
      if (cond.maxAge != null && player.age > cond.maxAge) return false;
      if (cond.maxPrice != null && player.price > cond.maxPrice) return false;
      if (cond.minRating != null && player.rating < cond.minRating) return false;
      return true;
    });
    if (!pass) return false;
  }
  if (filter.freeAgentOnly && player.price !== 0) return false;
  return true;
}

function fail(message) {
  return { ok: false, ruleId: 'TRANSFER_MENU', message, overridable: true };
}

export function validateTransferMenu(tree, ctx, state, player) {
  const { menu } = resolveMenu(tree, ctx, state.menuNodeId ?? state.nodeId ?? null);
  if (!matchesFilter(player, menu.filter, ctx)) {
    return fail(`Pemain di luar menu ${menu.label ?? 'aktif'}. Cari pemain yang lolos filter menu ini.`);
  }
  if (menu.limits?.maxPurchases != null && ctx.purchaseCount >= menu.limits.maxPurchases) {
    return fail(`Batas pembelian menu ${menu.label ?? ''} sudah tercapai.`);
  }
  return { ok: true };
}

export function advanceMenu(tree, ctx, menuNodeId, player) {
  const { menu } = resolveMenu(tree, ctx, menuNodeId ?? null);
  const transition = menu.onPurchase?.find((t) => evalCondition(t.if, { player, ...ctx }));
  return transition ? transition.next : menuNodeId;
}

export function validateClaimAgainstMenu(tree, mgrState, target) {
  const ctx = mgrState.ctx ?? mgrState;
  const nodeId = mgrState.menuNodeId ?? mgrState.nodeId ?? null;
  return validateTransferMenu(tree, ctx, { menuNodeId: nodeId }, target);
}

// Filter kandidat pick v3: kembalikan { allowed, locked: [{id, reason}] }.
export function filterCandidates(tree, ctx, nodeId, candidates) {
  const allowed = [];
  const locked = [];
  for (const c of candidates) {
    const r = validateTransferMenu(tree, ctx, { menuNodeId: nodeId }, c);
    if (r.ok) allowed.push(c);
    else locked.push({ id: c.id, reason: r.message });
  }
  return { allowed, locked };
}

export function validateMarketCompletion(tree, ctx, state) {
  const { menu } = resolveMenu(tree, ctx, state.menuNodeId ?? state.nodeId ?? null);
  if (menu.mustBuy) {
    const required = menu.mustBuy.positions === '$soldPositions' ? ctx.soldPositions : menu.mustBuy.positions;
    const bought = state.purchases.filter((p) => required.includes(p.position)).length;
    if (bought < menu.mustBuy.min) {
      return {
        ok: false,
        ruleId: 'TRANSFER_MENU',
        message: `Menu ${menu.label ?? ''} mewajibkan minimal ${menu.mustBuy.min} pemain di posisi ${required.join('/')}.`,
      };
    }
  }
  return { ok: true };
}
