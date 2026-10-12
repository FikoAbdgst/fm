import { useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Button, Notice } from './common.jsx';

// Toolbar host: Urungkan, Catatan Sesi, Layar Bersama.
export function ModeratorBar({ state, actions, managersView }) {
  const [showLog, setShowLog] = useState(false);
  const [msg, setMsg] = useState(null);

  const undo = () => {
    const r = actions.undo();
    setMsg(r.ok ? { tone: 'success', message: 'Langkah terakhir dibatalkan.' } : { tone: 'error', message: r.message });
  };

  return (
    <div className="player-card mt-4 p-4" aria-label="Toolbar host">
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={undo} disabled={!state._past?.length} aria-label="Batalkan langkah terakhir (U)">
          Urungkan ({state._past?.length ?? 0})
        </Button>
        <Button variant="ghost" onClick={() => setShowLog((v) => !v)} aria-label="Tampilkan catatan sesi">
          {showLog ? 'Sembunyikan Catatan' : `Catatan Sesi (${state.eventLog?.length ?? 0})`}
        </Button>
        <Button variant="ghost" onClick={() => window.open(`${window.location.pathname}?view=display`, '_blank')} aria-label="Buka layar bersama di tab baru">
          Buka Layar Bersama
        </Button>
      </div>
      <div className="mt-2"><Notice tone={msg?.tone} message={msg?.message} onDismiss={() => setMsg(null)} /></div>
      {showLog && <EventLogDrawer log={state.eventLog} managersView={managersView} />}
    </div>
  );
}

export function EventLogDrawer({ log, managersView }) {
  const nameOf = (id) => managersView?.find((m) => m.id === id)?.name ?? id ?? '-';
  return (
    <ol className="tnum mt-3 max-h-64 space-y-1 overflow-auto rounded-xl border border-[#2A3D6E] p-3 text-xs" aria-label="Catatan sesi">
      {[...(log ?? [])].reverse().slice(0, 60).map((e) => (
        <li key={e.n} className="flex gap-2">
          <span className="text-[#A9BCE6]">#{e.n}</span>
          <strong>{e.type}</strong>
          <span className="text-[#A9BCE6]">{e.managerId ? nameOf(e.managerId) : ''} {e.entityId ?? ''}</span>
        </li>
      ))}
      {(!log || log.length === 0) && <li className="text-[#A9BCE6]">Belum ada catatan.</li>}
    </ol>
  );
}

export function useModeratorShortcuts({ actions, state }) {
  useGame(); // pastikan dalam provider
  return null;
}
