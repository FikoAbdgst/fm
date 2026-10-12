import { useState } from 'react';
import { useDisplaySync } from '../hooks/useBroadcast.js';
import { formatEuro } from '../utils/format.js';
import { Avatar, Badge } from './common.jsx';
import { PitchView } from './ReviewBoard.jsx';

// Layar Bersama read-only untuk penonton (?view=display).
// Pilihan tampil terbuka, sama seperti layar host.
export function DisplayView({ liveState, dataset, entityMap }) {
  const [mirror, setMirror] = useState(null);
  const [tab, setTab] = useState(null);
  useDisplaySync(setMirror);
  const state = liveState?.sessionId ? liveState : mirror;
  const entities = entityMap ?? dataset.entityMap;
  if (!state?.managers?.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="font-display text-3xl font-extrabold uppercase tracking-wide">Menunggu host memulai...</p>
        <p className="mt-2 text-[#A9BCE6]">Layar ini ikut otomatis setelah sesi jalan.</p>
      </div>
    );
  }
  const nameOf = (id) => entities?.get(id)?.name ?? id;
  const turn = state.turns?.[state.currentTurnIndex];
  const activeId = tab ?? state.managers[0]?.id;
  const active = state.managers.find((m) => m.id === activeId) ?? state.managers[0];
  // Saat SUSUN TIM (tim manager belum dibentuk), preview dari susunan host.
  // Saat MAIN, preview dari slot tim yang sedang dirombak + penanda yang diganti.
  const previewSlots = state.phase === 'COMPOSE'
    ? [
      ...Object.entries(state.compose?.slots ?? {}).map(([slotId, s]) => ({ slotId, entityId: s?.starterId ?? null })),
      { slotId: 'COACH', entityId: state.compose?.coach?.starterId ?? null },
    ]
    : (active?.slots ?? []);
  const starterOf = (slotId) => slotId === 'COACH'
    ? state.compose?.coach?.starterId
    : state.compose?.slots?.[slotId]?.starterId;
  const soldBy = (slotId) => (state.turns ?? []).find((t) =>
    t.slotId === slotId && t.decisions?.[active?.id] === 'SELL');
  const lineup = previewSlots
    .filter((s) => s.slotId !== 'COACH')
    .map((s) => {
      const entity = s.entityId ? entities?.get(s.entityId) ?? null : null;
      const turn = soldBy(s.slotId);
      const starterId = starterOf(s.slotId);
      const isNew = state.phase === 'DRAFT' && !!turn && s.entityId && starterId && s.entityId !== starterId;
      return {
        slotId: s.slotId, entity,
        isNew,
        oldName: isNew ? nameOf(starterId) : null,
      };
    });
  const coachSlot = previewSlots.find((s) => s.slotId === 'COACH');
  const coach = coachSlot?.entityId ? entities?.get(coachSlot.entityId) ?? null : null;
  const missing = previewSlots.filter((s) => !s.entityId).map((s) => s.slotId);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="scorebug flex flex-wrap items-center gap-3 p-4">
        <span className="live-dot" data-on="true" aria-label="Siaran langsung" />
        <p className="font-display text-2xl font-extrabold uppercase tracking-wide">Menjadi Manager <span className="text-[#FFC531]">Live</span></p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {(state.managers ?? []).map((m) => (
          <div key={m.id} className="player-card min-w-[140px] flex-1 p-4" style={{ borderColor: `${m.color}66` }}>
            <p className="font-display font-bold uppercase tracking-wide" style={{ color: m.color }}>{m.name}</p>
            <p className="tnum font-display text-3xl font-extrabold text-[#FFC531]">{formatEuro(m.budget)}</p>
            <p className="text-xs text-[#A9BCE6]">{m.slots.filter((s) => s.entityId).length}/12 terisi</p>
          </div>
        ))}
      </div>
      {state.auction && (() => {
        const a = state.auction;
        const leader = (state.managers ?? []).find((m) => m.id === a.leaderId);
        return (
          <div className="player-card mt-6 p-6 text-center" data-active="true" aria-label="Lelang live">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FF8A73]">Rebutan lelang</p>
            <p className="font-display text-4xl font-extrabold uppercase tracking-wide">{nameOf(a.targetId)}</p>
            <p className="tnum mt-2 font-display text-3xl font-extrabold text-[#FFC531]">{formatEuro(a.currentBid)}</p>
            <p className="text-sm text-[#A9BCE6]">dipegang {leader?.name ?? '-'} · harga awal {formatEuro(a.basePrice)}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {(a.eligible ?? []).map((id) => {
                const m = (state.managers ?? []).find((x) => x.id === id);
                return <Badge key={id} tone={id === a.leaderId ? 'gold' : 'neutral'}>{m?.name}</Badge>;
              })}
            </div>
          </div>
        );
      })()}
      {state.phase === 'DRAFT' && turn && (
        <div className="player-card mt-6 p-6 text-center" data-active="true">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[#A9BCE6]">Giliran: {turn.slotId} ({turn.status === 'SEALED' ? 'mengumpulkan pilihan' : 'hasil dibuka'})</p>
          <p className="font-display text-4xl font-extrabold uppercase tracking-wide">{nameOf(state.compose?.slots?.[turn.slotId]?.starterId ?? state.compose?.coach?.starterId)}</p>
          {turn.status === 'SEALED' ? (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {state.managers.map((m) => (
                <span key={m.id}>
                  {turn.decisions?.[m.id] === 'KEEP'
                    ? <Badge tone="keep">{m.name} Pertahankan</Badge>
                    : turn.decisions?.[m.id] === 'SELL'
                      ? <Badge tone="sell">{m.name} Jual</Badge>
                      : <Badge>{m.name} menunggu</Badge>}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {state.managers.map((m) => (
                <span key={m.id}>
                  {turn.decisions?.[m.id] === 'KEEP'
                    ? <Badge tone="keep">{m.name} Pertahankan</Badge>
                    : <Badge tone="sell">{m.name} Jual{turn.picks?.[m.id]?.candidateId ? `, ganti ${nameOf(turn.picks[m.id].candidateId)}` : ''}</Badge>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {state.phase === 'REVIEW' && (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {(state.managers ?? []).map((m) => (
            <div key={m.id} className="player-card p-4">
              <p className="font-display font-bold uppercase tracking-wide" style={{ color: m.color }}>{m.name}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {m.slots.filter((s) => s.entityId).map((s) => (
                  <li key={s.slotId} className="flex items-center gap-2">
                    <Avatar name={nameOf(s.entityId)} size={24} />
                    <span className="truncate">{nameOf(s.entityId)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {(state.phase === 'DRAFT' || state.phase === 'COMPOSE') && active && (
        <div className="player-card mt-6 p-6" data-active="true" aria-label="Preview formasi sementara">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Formasi Sementara</h2>
              <p className="tnum text-sm text-[#A9BCE6]" role="status">
                {missing.length === 0
                  ? 'Lengkap 12/12.'
                  : `Kurang ${missing.length} posisi: ${missing.join(', ')}.`}
              </p>
            </div>
            {state.phase === 'DRAFT' && (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pilih tim">
                {state.managers.map((m) => (
                  <button key={m.id} role="tab" aria-selected={m.id === active.id} onClick={() => setTab(m.id)}
                    className={`min-h-[44px] rounded-[10px] border px-4 font-display font-bold uppercase tracking-wide ${m.id === active.id ? 'border-[#FFC531] bg-[#1A2F5E] text-[#FFC531]' : 'border-[#2A3D6E] text-[#A9BCE6]'}`}>
                    <span style={{ color: m.color }}>●</span> {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {state.phase === 'DRAFT' ? (
            <p className="tnum mt-1 text-sm" style={{ color: active.color }}>{active.name} · {formatEuro(active.budget)} tersisa</p>
          ) : (
            <p className="mt-1 text-sm text-[#A9BCE6]">Susunan awal, sama untuk semua manager.</p>
          )}
          {state.phase === 'DRAFT' && (() => {
            const changed = lineup.filter((l) => l.isNew);
            if (!changed.length) return null;
            return (
              <p className="mt-1 text-xs text-[#A9BCE6]" role="status">
                Diganti ({changed.length}): {changed.map((l) => `${l.slotId}: ${l.oldName} diganti ${l.entity?.name ?? '?'}`).join(' · ')}
              </p>
            );
          })()}
          <PitchView lineup={lineup} coach={coach} />
          {state.phase === 'DRAFT' && (() => {
            const coachTurn = soldBy('COACH');
            const coachStarterId = starterOf('COACH');
            const coachChanged = coachTurn && coachSlot?.entityId && coachStarterId && coachSlot.entityId !== coachStarterId;
            if (!coachChanged) return null;
            return (
              <p className="mt-1 text-center text-xs text-[#FFC531]" role="status">
                Pelatih diganti: {nameOf(coachStarterId)} diganti {coach?.name ?? '?'} (BARU)
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
