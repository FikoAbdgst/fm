import { useRef, useState } from 'react';
import { formatEuro } from '../utils/format.js';
import { Avatar, Button, Modal, Notice } from './common.jsx';

// HASIL AKHIR: sandingan tim, tanpa pemenang.
export function ReviewBoard({ managersView, comparison, state, actions, entityMap, club }) {
  const [tab, setTab] = useState(managersView[0]?.id);
  const [notice, setNotice] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef(null);
  const allRef = useRef(null);

  const mgr = managersView.find((m) => m.id === tab) ?? managersView[0];
  if (!mgr) return null;

  const shot = async (ref, filename) => {
    if (!ref.current) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(ref.current, { cacheBust: true, backgroundColor: '#0A1730' });
      const a = document.createElement('a');
      a.download = filename;
      a.href = dataUrl;
      a.click();
      setNotice({ tone: 'success', message: 'Gambar terunduh. Bagikan ke komunitas.' });
    } catch {
      setNotice({ tone: 'error', message: 'Ekspor gagal di peramban ini. Coba Chrome atau Edge terbaru.' });
    } finally {
      setExporting(false);
    }
  };

  const decisions = (state.turns ?? []).map((t) => {
    const pickId = t.picks?.[mgr.id]?.candidateId;
    const pickEnt = pickId ? entityMap.get(pickId) : null;
    return {
      slotId: t.slotId,
      d: t.decisions?.[mgr.id],
      pick: pickEnt ? `${pickEnt.name}${pickEnt.clubName ? ` (${pickEnt.clubName})` : ''}` : null,
    };
  });

  return (
    <section aria-labelledby="review-title">
      <div className="scorebug p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 id="review-title" className="font-display text-2xl font-extrabold uppercase tracking-wide">Hasil akhir: {club?.name}</h1>
            <p className="text-sm text-white/85">Bukan menang atau kalah. Bandingkan racikan tiap manager.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => shot(cardRef, `fm-${mgr.name}.png`)} disabled={exporting} aria-label="Ekspor tim ini sebagai PNG" className="border-white/50 text-white hover:border-white">
              {exporting ? 'Mengekspor...' : 'Ekspor Tim Ini'}
            </Button>
            <Button variant="ghost" onClick={() => shot(allRef, 'fm-semua-tim.png')} disabled={exporting} aria-label="Ekspor semua tim sebagai PNG" className="border-white/50 text-white hover:border-white">
              Ekspor Semua
            </Button>
            <Button onClick={() => setConfirmReset(true)} aria-label="Reset dan main lagi">Main Lagi</Button>
          </div>
        </div>
      </div>

      <div className="mt-3"><Notice tone={notice?.tone} message={notice?.message} onDismiss={() => setNotice(null)} /></div>

      <div ref={allRef} className="player-card mt-4 p-6" data-active="true">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#FFC531]">Sandingan tim (urut abjad pendaftaran, bukan peringkat)</h2>
        <ol className="mt-2 space-y-2">
          {comparison.map((row) => {
            const m = managersView.find((x) => x.id === row.managerId);
            const keeps = (state.turns ?? []).filter((t) => t.decisions?.[row.managerId] === 'KEEP').length;
            const sells = (state.turns ?? []).filter((t) => t.decisions?.[row.managerId] === 'SELL').length;
            return (
              <li key={row.managerId} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2A3D6E] p-3">
                <span className="inline-block h-4 w-4 rounded-full" style={{ background: m?.color }} aria-hidden="true" />
                <Avatar name={row.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold uppercase tracking-wide" style={{ color: m?.color }}>{row.name}</p>
                  <p className="tnum text-xs text-[#A9BCE6]">Pertahankan {keeps} · Jual {sells} · penalti {m?.penalties ?? 0}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="tnum font-display text-xl font-extrabold text-[#FFC531]">{formatEuro(row.budget)}</p>
                  <p className="tnum text-[#A9BCE6]">belanja {formatEuro(m?.totalSpend ?? 0)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Pilih tim">
        {managersView.map((m) => (
          <button key={m.id} role="tab" aria-selected={tab === m.id} onClick={() => setTab(m.id)}
            className={`min-h-[44px] rounded-[10px] border px-4 font-display font-bold uppercase tracking-wide ${tab === m.id ? 'border-[#FFC531] bg-[#1A2F5E] text-[#FFC531]' : 'border-[#2A3D6E] text-[#A9BCE6]'}`}>
            <span style={{ color: m.color }}>●</span> {m.name}
          </button>
        ))}
      </div>

      <div ref={cardRef} className="player-card mt-4 p-6" data-active="true">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[#A9BCE6]">{mgr.name} ({mgr.formation})</p>
            <p className="tnum font-display text-4xl font-extrabold text-[#FFC531]">{formatEuro(mgr.budget)} <span className="text-lg text-[#A9BCE6]">sisa</span></p>
            <p className="text-sm text-[#A9BCE6]">Pelatih {mgr.coach ? mgr.coach.name : '-'}</p>
          </div>
          <div className="text-right">
            <p className="tnum text-sm text-[#A9BCE6]">Belanja {formatEuro(mgr.totalSpend)} · penalti {mgr.penalties ?? 0}</p>
          </div>
        </div>
        <h2 className="mt-4 font-display text-sm font-bold uppercase tracking-widest text-[#A9BCE6]">Catatan tiap giliran</h2>
        <ol className="mt-2 flex flex-wrap gap-2 text-xs">
          {decisions.map((d) => (
            <li key={d.slotId} className={`rounded-full border px-3 py-1 ${d.d === 'KEEP' ? 'border-[#2FBD73] text-[#57D895]' : 'border-[#C93A2E] text-[#FF8A73]'}`}>
              {d.slotId}: {d.d === 'KEEP' ? 'Pertahankan' : `Jual, ganti ${d.pick ?? 'kosong'}`}
            </li>
          ))}
        </ol>
        <h2 className="mt-5 font-display text-sm font-bold uppercase tracking-widest text-[#A9BCE6]">Susunan akhir ({mgr.formation}) + Pelatih</h2>
        <PitchView lineup={mgr.lineup} coach={mgr.coach} />
      </div>

      {confirmReset && (
        <Modal title="Mulai lagi dari awal?" onClose={() => setConfirmReset(false)}>
          <p className="text-sm text-[#A9BCE6]">Sesi tersimpan akan dihapus permanen.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmReset(false)} className="flex-1">Batal</Button>
            <Button variant="sell" onClick={() => actions.resetGame()} className="flex-1" aria-label="Ya, reset game">Ya, Reset</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function PitchView({ lineup, coach }) {
  const has = (ids) => (l) => ids.includes(l.slotId);
  const gk = lineup.filter(has(['GK']));
  const df = lineup.filter((l) => ['LB', 'CB1', 'CB2', 'RB', 'CB3', 'LWB', 'RWB'].includes(l.slotId));
  const mf = lineup.filter((l) => l.slotId.startsWith('CM') || l.slotId.startsWith('CDM') || l.slotId.startsWith('CAM') || ['LM', 'RM'].includes(l.slotId));
  const fw = lineup.filter((l) => ['LW', 'ST', 'RW', 'ST1', 'ST2'].includes(l.slotId));
  const Row = ({ list }) => (
    <div className="flex justify-center gap-2">
      {(list.length ? list : [{ slotId: '?', entity: null }]).map((l, i) => (
        <div key={l.slotId + i} className={`flex w-20 flex-col items-center rounded-lg border bg-[#0A1730] px-1 py-2 text-center ${l.isNew ? 'border-[#FFC531]' : 'border-[#2A3D6E]'}`}>
          {l.entity ? <><Avatar name={l.entity.name} size={32} /><p className="mt-1 w-full truncate text-[11px] font-bold">{l.entity.name.split(' ').slice(-1)}</p>{l.isNew && <p className="text-[10px] font-bold uppercase tracking-wide text-[#FFC531]">Baru</p>}{l.oldName && <p className="w-full truncate text-[10px] text-[#A9BCE6]">ganti {l.oldName.split(' ').slice(-1)}</p>}</>
            : <p className="text-[11px] text-[#A9BCE6]">{l.slotId} · kosong</p>}
        </div>
      ))}
    </div>
  );
  return (
    <div className="mt-2 space-y-2 rounded-2xl border border-[#2A3D6E] bg-[#0d1c3d] p-4" aria-label="Formasi tim">
      <Row list={fw} />
      <Row list={mf} />
      <Row list={df} />
      <Row list={gk} />
      <p className="text-center text-xs text-[#A9BCE6]">Pelatih: {coach ? coach.name : '-'}</p>
    </div>
  );
}
