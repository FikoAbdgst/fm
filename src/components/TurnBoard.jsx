import { useState } from 'react';
import { minNextBid } from '../rules/bidding.js';
import { formatEuro } from '../utils/format.js';
import { Avatar, Badge, Button, Notice } from './common.jsx';

// Fase MAIN: 12 giliran, satu posisi per giliran, pilihan saling terlihat.
// Santai: tanpa modifier, tanpa ranking, tanpa override.
export function TurnBoard({ state, actions, derived, entityMap }) {
  const [notice, setNotice] = useState(null);
  const [pickSel, setPickSel] = useState({});
  const { turn, managersView } = derived;

  if (!turn) return null;
  const isCoach = turn.slotId === 'COACH';
  const slotCompose = isCoach ? state.compose.coach : state.compose.slots[turn.slotId];
  const starter = slotCompose?.starterId ? entityMap.get(slotCompose.starterId) : null;
  const cands = (slotCompose?.candidateIds ?? []).map((id) => entityMap.get(id)).filter(Boolean);
  const sealed = turn.status === 'SEALED';

  const decide = (mgrId, decision) => {
    const res = actions.decide(mgrId, decision);
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else setNotice(null);
  };

  const reveal = () => {
    const res = actions.revealTurn();
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else setNotice({ tone: 'success', message: 'Hasil giliran dibuka.' });
  };

  const doPick = (mgrId) => {
    const sel = pickSel[mgrId] ?? cands[0]?.id;
    const res = actions.pick(mgrId, sel);
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else if (res.outcome === 'EMPTY') setNotice({ tone: 'success', message: 'Dana tidak cukup. Posisi ini dikosongkan.' });
    else if (res.outcome === 'CONTESTED') setNotice({ tone: 'success', message: res.message });
    else setNotice({ tone: 'success', message: `Pilihan dicatat (${formatEuro(res.price)}). Tekan Bayar dan Selesaikan agar resmi dibeli.` });
  };

  const settle = () => {
    const res = actions.settlePicks();
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else if (res.contested) setNotice({ tone: 'success', message: `${res.uncontested} langsung dibeli, ${res.contested} masuk lelang.` });
    else setNotice({ tone: 'success', message: `${res.uncontested} pilihan dibeli dengan harga awal.` });
  };

  const settleAuction = () => {
    const res = actions.settleAuction();
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else setNotice({ tone: 'success', message: res.message });
  };

  const advance = () => {
    const res = actions.nextTurn();
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else { setNotice(null); setPickSel({}); }
  };

  return (
    <section aria-labelledby="turn-title">
      <div className="scorebug p-4" data-active="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="live-dot" data-on={sealed} aria-label={sealed ? 'Mengumpulkan pilihan' : 'Hasil dibuka'} />
            <div>
              <h1 id="turn-title" className="font-display text-2xl font-extrabold uppercase tracking-wide">
                Giliran {derived.progress.done + 1 > derived.progress.total ? derived.progress.total : derived.progress.done + 1}/{derived.progress.total}: {isCoach ? 'Pelatih' : turn.slotId}
              </h1>
              <p className="text-sm text-white/85" role="status">
                {sealed ? 'Semua pilihan masih dikumpulkan, saling terlihat.' : 'Hasil sudah dibuka.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {sealed ? (
              <Button onClick={reveal} aria-label="Buka hasil giliran (R)">Buka Hasil (R)</Button>
            ) : (
              <Button onClick={advance} aria-label={derived.progress.done + 1 >= derived.progress.total ? 'Selesai dan lihat hasil akhir' : 'Giliran berikutnya'}>
                {derived.progress.done + 1 >= derived.progress.total ? 'Selesai, Lihat Hasil' : 'Giliran Berikutnya'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Notice tone={notice?.tone} message={notice?.message} onDismiss={() => setNotice(null)} />
      </div>

      <div className="player-card mt-4 p-4" data-active="true">
        <div className="flex items-center gap-3">
          {starter && <Avatar name={starter.name} size={52} />}
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold uppercase tracking-wide">{isCoach ? 'Pelatih' : turn.slotId}: {starter?.name ?? '?'}</p>
            {starter && (
              <p className="tnum text-sm text-[#A9BCE6]">
                {starter.type === 'COACH' ? 'Pelatih' : starter.subPosition} · Harga {formatEuro(starter.price)}
                {starter.minutes != null && starter.type === 'PLAYER' ? ` · ${starter.minutes}' musim lalu` : ''}
              </p>
            )}
          </div>
        </div>
        {cands.length > 0 && (
          <div className="mt-3">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[#A9BCE6]">3 pengganti dari klub lain (termurah dulu)</p>
            <ul className="mt-1 grid gap-2 sm:grid-cols-3">
              {cands.map((c, i) => (
                <li key={c.id} className={`rounded-xl border p-2 text-sm ${i === 0 ? 'border-[#FFC531]' : 'border-[#2A3D6E]'}`}>
                  <strong>{c.name}</strong>
                  <span className="block text-xs text-[#A9BCE6]">{c.clubName ?? ''}</span>
                  <span className="tnum block font-display text-sm font-extrabold text-[#FFC531]">{formatEuro(c.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {managersView.map((m) => (
          <ManagerTurnCard key={m.id} m={m} turn={turn} sealed={sealed}
            starter={starter} cands={cands}
            pickSel={pickSel[m.id]} setPickSel={setPickSel}
            decide={decide} onAbsent={(id) => { const r = actions.markAbsent(id); if (!r.ok) setNotice({ tone: 'error', message: r.message }); }} doPick={doPick} onWithdraw={(id) => { const r = actions.withdrawClaim(id); if (!r.ok) setNotice({ tone: 'error', message: r.message }); else setNotice(null); }} entityMap={entityMap} />
        ))}
      </ul>
      {!sealed && <ClaimQueue turn={turn} managersView={managersView} entityMap={entityMap} actions={actions} setNotice={setNotice} onSettle={settle} />}
      {derived.auction && (
        <AuctionPanel auction={derived.auction} managersView={managersView} entityMap={entityMap} actions={actions} setNotice={setNotice} onSettle={settleAuction} />
      )}
      {derived.pendingPickCount > 0 && !sealed && !derived.auction && (
        <p className="mt-3 text-sm text-[#FFC531]" role="status">{derived.pendingPickCount} manager belum memilih pengganti. Giliran belum bisa lanjut.</p>
      )}
    </section>
  );
}

function ManagerTurnCard({ m, turn, sealed, starter, cands, pickSel, setPickSel, decide, onAbsent, doPick, onWithdraw, entityMap }) {
  const decision = turn.decisions?.[m.id];
  const picked = turn.picks?.[m.id];
  const claim = (turn.claims ?? []).find((c) => c.managerId === m.id);
  const absent = (turn.absent ?? []).includes(m.id);

  return (
    <li className="player-card p-4" style={{ borderColor: `${m.color}44` }}>
      <div className="flex items-center gap-2">
        <span className="font-display font-bold uppercase tracking-wide" style={{ color: m.color }}>{m.name}</span>
        <span className="tnum ml-auto text-xs text-[#A9BCE6]">{formatEuro(m.budget)}</span>
      </div>

      {sealed ? (
        <div className="mt-3">
          {decision ? (
            <p className="text-sm">
              {decision === 'KEEP' ? <Badge tone="keep">Pertahankan</Badge> : <Badge tone="sell">Jual</Badge>}
              <span className="ml-2 text-[#A9BCE6]">sudah dipilih, terlihat semua.</span>
            </p>
          ) : absent ? (
            <p className="text-sm text-[#A9BCE6]">Dilewati, otomatis Pertahankan saat hasil dibuka.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="keep" aria-label={`Pertahankan pemain untuk ${m.name}`} title="Tetap pakai pemain ini" onClick={() => decide(m.id, 'KEEP')}>
                Pertahankan
              </Button>
              <Button variant="sell" aria-label={`Jual pemain untuk ${m.name}`}
                title="Jual pemain ini" onClick={() => decide(m.id, 'SELL')}>
                Jual
              </Button>
            </div>
          )}
          {!decision && !absent && (
            <button type="button" className="mt-2 text-xs text-[#A9BCE6] underline" onClick={() => onAbsent(m.id)} aria-label={`Lewati ${m.name}, otomatis Pertahankan`}>
              lewati (otomatis Pertahankan)
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            {absent ? 'Dilewati (Pertahankan).' : decision === 'KEEP' ? <><Badge tone="keep">Pertahankan</Badge> {starter?.name} bertahan.</> : <><Badge tone="sell">Jual</Badge> {starter?.name} terjual <span className="tnum text-[#57D895]">(+{formatEuro(starter?.price ?? 0)})</span>.</>}
          </p>
          {decision === 'SELL' && !absent && !picked && !claim && (
            <div className="rounded-xl border border-[#FFC531] p-3">
              <label className="text-sm">Pilih pengganti
                <select value={pickSel ?? cands[0]?.id ?? ''} onChange={(e) => setPickSel((p) => ({ ...p, [m.id]: e.target.value }))}
                  className="mt-1 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3">
                  {cands.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.clubName ?? ''}) {formatEuro(c.price)}</option>)}
                </select>
              </label>
              <Button onClick={() => doPick(m.id)} className="mt-2 w-full" aria-label={`Ambil pengganti untuk ${m.name}`}>Ambil Pengganti Ini</Button>
            </div>
          )}
          {decision === 'SELL' && !absent && !picked && claim && (
            <div className="rounded-xl border border-[#2A3D6E] p-3 text-sm">
              <p>Dipilih: <strong>{entityMap.get(claim.candidateId)?.name}</strong> ({formatEuro(entityMap.get(claim.candidateId)?.price ?? 0)}).</p>
              <p className="text-xs text-[#A9BCE6]">Belum resmi. Tekan Bayar dan Selesaikan di bawah.</p>
              <button type="button" onClick={() => onWithdraw(m.id)} className="mt-1 text-xs text-[#A9BCE6] underline" aria-label={`Batalkan pilihan ${m.name}`}>Batalkan</button>
            </div>
          )}
          {picked?.candidateId && (
            <p className="text-sm text-[#57D895]">→ {entityMap.get(picked.candidateId)?.name} bergabung.</p>
          )}
          {picked && !picked.candidateId && (
            <p className="text-sm text-[#FF8A73]">→ posisi kosong (dana tidak cukup).</p>
          )}
        </div>
      )}
    </li>
  );
}

function ClaimQueue({ turn, managersView, entityMap, actions, setNotice, onSettle }) {
  const claims = turn?.claims ?? [];
  if (!claims.length) return null;
  const byTarget = new Map();
  for (const c of claims) {
    if (!byTarget.has(c.candidateId)) byTarget.set(c.candidateId, []);
    byTarget.get(c.candidateId).push(c);
  }
  const nameOf = (id) => managersView.find((m) => m.id === id)?.name ?? id;
  return (
    <div className="player-card mt-4 p-4" aria-label="Daftar pilihan yang menunggu dibayar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#FFC531]">
          Menunggu dibayar ({claims.length})
        </h2>
        <Button variant="ghost" onClick={onSettle} aria-label="Bayar semua pilihan, buka lelang bila rebutan">
          Bayar dan Selesaikan
        </Button>
      </div>
      <ul className="mt-2 space-y-2">
        {[...byTarget.entries()].map(([targetId, list]) => {
          const target = entityMap.get(targetId);
          const sorted = [...list].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
          return (
            <li key={targetId} className="rounded-xl border border-[#2A3D6E] p-3 text-sm">
              <p className="font-display font-bold">
                {target?.name} <span className="tnum text-[#A9BCE6]">({formatEuro(target?.price ?? 0)})</span>
                {sorted.length > 1 && <span className="ml-2 text-xs font-bold uppercase text-[#FF8A73]">Rebutan, masuk lelang</span>}
              </p>
              <ol className="mt-1 space-y-1">
                {sorted.map((c, i) => (
                  <li key={c.managerId} className="flex items-center gap-2 text-sm">
                    <span className="tnum text-[#A9BCE6]">#{i + 1}</span>
                    <span>{nameOf(c.managerId)}{i === 0 && sorted.length > 1 ? ' (pegang harga awal)' : ''}</span>
                    <button type="button" onClick={() => { const r = actions.withdrawClaim(c.managerId); if (!r.ok) setNotice({ tone: 'error', message: r.message }); }} className="ml-auto text-xs text-[#A9BCE6] underline" aria-label={`Batalkan pilihan ${nameOf(c.managerId)}`}>Batal</button>
                  </li>
                ))}
              </ol>
              {sorted.length > 1 && (
                <Button variant="ghost" className="mt-2" onClick={() => { const r = actions.openAuction(targetId); setNotice(r.ok ? { tone: 'success', message: r.message } : { tone: 'error', message: r.message }); }} aria-label={`Buka lelang ${target?.name}`}>
                  Buka Lelang
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AuctionPanel({ auction, managersView, entityMap, actions, setNotice, onSettle }) {
  const [amount, setAmount] = useState('');
  const [bidder, setBidder] = useState('');
  const target = entityMap.get(auction.targetId);
  const nameOf = (id) => managersView.find((m) => m.id === id)?.name ?? id;
  const min = minNextBid(auction.currentBid);
  const bidders = auction.eligible.filter((id) => id !== auction.leaderId);
  const activeBidder = bidder && bidders.includes(bidder) ? bidder : bidders[0];
  const bidderBudget = managersView.find((m) => m.id === activeBidder)?.budget ?? 0;
  const parsed = amount === '' ? null : Number(amount);
  const customError = !activeBidder
    ? 'Semua sudah mundur kecuali pemegang.'
    : parsed == null || !Number.isFinite(parsed) ? null
    : parsed < min - 1e-9 ? `Minimal ${formatEuro(min)} (tawaran tertinggi + €1M).`
    : parsed > bidderBudget + 1e-9 ? `Melebihi dana ${nameOf(activeBidder)} (${formatEuro(bidderBudget)}).`
    : null;
  const bid = (managerId, amt) => {
    const res = actions.placeBid(managerId, amt);
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else { setNotice({ tone: 'success', message: `Tawaran ${formatEuro(res.amount)} oleh ${nameOf(managerId)}.` }); setAmount(''); }
  };
  return (
    <div className="player-card mt-4 p-4" data-active="true" aria-label="Lelang rebutan sedang berjalan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="live-dot" data-on="true" aria-label="Lelang berjalan" />
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[#A9BCE6]">Rebutan lelang</p>
            <p className="font-display text-2xl font-extrabold uppercase tracking-wide">{target?.name}</p>
            <p className="tnum text-sm text-[#A9BCE6]">
              Harga awal {formatEuro(auction.basePrice)} · naik minimal €1M · batasnya sisa dana
            </p>
          </div>
        </div>
        <div className="scorebug px-5 py-3 text-center" role="status">
          <p className="font-display text-[11px] font-bold uppercase tracking-widest text-white/85">Tawaran tertinggi</p>
          <p className="tnum font-display text-3xl font-extrabold text-[#FFC531]">{formatEuro(auction.currentBid)}</p>
          <p className="text-xs text-white/85">oleh {nameOf(auction.leaderId)}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {auction.eligible.map((id) => {
          const m = managersView.find((x) => x.id === id);
          const isLeader = id === auction.leaderId;
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#2A3D6E] p-3 text-sm">
              <span className="font-display font-bold uppercase tracking-wide" style={{ color: m?.color }}>{m?.name}</span>
              <span className="tnum text-xs text-[#A9BCE6]">{formatEuro(m?.budget ?? 0)}{isLeader ? ' · memegang' : ''}</span>
              <span className="ml-auto flex gap-2">
                <Button variant="ghost" disabled={isLeader} onClick={() => bid(id)} aria-label={`${m?.name} tawar minimal ${formatEuro(min)}`}>
                  +€1M ({formatEuro(min)})
                </Button>
                <Button variant="ghost" onClick={() => { const r = actions.withdrawBid(id); setNotice(r.ok ? { tone: 'success', message: r.message ?? 'Mundur dari lelang.' } : { tone: 'error', message: r.message }); }} aria-label={`${m?.name} mundur dari lelang`}>
                  Mundur
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label className="text-sm">Tawar dengan angka sendiri
          <select value={activeBidder ?? ''} onChange={(e) => setBidder(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3" aria-label="Pilih penawar">
            {bidders.map((id) => <option key={id} value={id}>{nameOf(id)} ({formatEuro(managersView.find((m) => m.id === id)?.budget ?? 0)})</option>)}
          </select>
        </label>
        <label className="text-sm">Angka (min {formatEuro(min)})
          <input type="number" step={1} min={min} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(min)}
            className="mt-1 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3" aria-label={`Angka tawaran, minimal ${min}`} />
        </label>
        <div className="flex items-end gap-2">
          <Button onClick={() => activeBidder && bid(activeBidder, parsed)} disabled={!activeBidder || parsed == null || customError != null} title={customError ?? (parsed != null ? `Tawar ${formatEuro(parsed)} untuk ${nameOf(activeBidder)}` : 'Isi angka dulu')} className="flex-1" aria-label="Kirim tawaran">Kirim Tawaran</Button>
          <Button variant="keep" onClick={onSettle} aria-label="Sahkan lelang, menangkan penawar tertinggi">SOLD</Button>
        </div>
      </div>
      {customError && parsed != null && (
        <p className="mt-1 text-xs text-[#FF8A73]" role="alert">{customError}</p>
      )}
      {(auction.bids ?? []).length > 0 && (
        <ol className="tnum mt-3 flex flex-wrap gap-2 text-xs">
          {auction.bids.map((b, i) => (
            <li key={i} className="rounded-full border border-[#2A3D6E] px-3 py-1">
              {nameOf(b.managerId)} {formatEuro(b.amount)}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-[#A9BCE6]">Yang kalah lelang wajib pilih pengganti lain dari posisi ini.</p>
    </div>
  );
}
