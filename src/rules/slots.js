// Aturan kecocokan slot formasi (PRD 3.2).
export const PARTIAL_FACTOR = 0.95;

export const round1 = (n) => Math.round(Number(n) * 10) / 10;

export function isCompatible(entity, slot) {
  if (!slot) return { ok: false };
  if (slot.role === 'COACH' || slot.slotId === 'COACH') {
    return entity.type === 'COACH' ? { ok: true, factor: 1 } : { ok: false };
  }
  if (entity.type !== 'PLAYER') return { ok: false };
  const sub = entity.subPosition || entity.position;
  if (slot.accepts?.includes(sub)) return { ok: true, factor: 1 };
  if (slot.accepts?.includes(entity.position)) return { ok: true, factor: 1 };
  if (slot.adjacent?.includes(sub)) return { ok: true, factor: PARTIAL_FACTOR };
  return { ok: false };
}

export function slotGroupOf(slot) {
  return slot?.group ?? null;
}

export function countEmptySlots(manager) {
  return (manager.slots ?? []).filter((s) => !s.entityId).length;
}
