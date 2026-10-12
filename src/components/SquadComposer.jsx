import { useEffect, useMemo, useState } from 'react';
import { slotsFor } from '../config/formations.js';
import { isCompatible } from '../rules/slots.js';
import { formatEuro, normText } from '../utils/format.js';
import { Avatar, Badge, Button, Notice } from './common.jsx';

// Fase SUSUN TIM: pilih pemain inti (dari skuad klub) + 3 pengganti luar klub per posisi.
export function SquadComposer({ state, actions, entityMap, squad, targets, coaches, clubId, datasetIssues, onReloadDataset }) {
  const [notice, setNotice] = useState(null);
  const defs = useMemo(() => slotsFor(state.config.formation), [state.config.formation]);
  const byGroup = useMemo(() => {
    const g = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of squad) if (g[p.position]) g[p.position].push(p);
    for (const k of Object.keys(g)) g[k].sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0) || b.price - a.price);
    return g;
  }, [squad]);

  const lock = () => {
    const res = actions.startDraft();
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
  };

  // Id terpakai per grup posisi (pemain inti + pengganti semua slot): dipakai untuk
  // menyembunyikan pemain yang sudah ada di posisi itu dari pencarian slot lain.
  const usedByGroup = useMemo(() => {
    const map = {};
    for (const [sid, s] of Object.entries(state.compose.slots)) {
      const sdef = defs.find((d) => d.slotId === sid);
      if (!sdef || sdef.slotId === 'COACH') continue;
      const set = (map[sdef.group] = map[sdef.group] ?? new Set());
      if (s?.starterId) set.add(s.starterId);
      for (const id of s?.candidateIds ?? []) set.add(id);
    }
    return map;
  }, [state.compose.slots, defs]);

  const filled = Object.values(state.compose.slots).filter((s) => s.starterId && (s.candidateIds ?? []).length === 3).length;
  const coachOk = state.compose.coach?.starterId && (state.compose.coach?.candidateIds ?? []).length === 3;

  return (
    <section aria-labelledby="compose-title">
      <div className="scorebug p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 id="compose-title" className="font-display text-2xl font-extrabold uppercase tracking-wide">Susun tim dan pengganti</h1>
            <p className="tnum mt-1 font-display text-xl font-extrabold text-[#FFC531]" role="status">
              {filled}/{defs.length - 1} posisi lengkap{coachOk ? ', pelatih lengkap' : ', pelatih belum lengkap'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => actions.autofillCompose()} aria-label="Isi otomatis: undi pemain inti dan pengganti per posisi">Acak Cepat</Button>
            <Button onClick={lock} aria-label="Kunci tim dan mulai main">Kunci Tim, Mulai Main</Button>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0A1730]/50" role="progressbar" aria-valuenow={filled + (coachOk ? 1 : 0)} aria-valuemin={0} aria-valuemax={defs.length} aria-label="Progres susun tim">
          <div className="h-full bg-[#FFC531] transition-all" style={{ width: `${((filled + (coachOk ? 1 : 0)) / defs.length) * 100}%` }} />
        </div>
      </div>
      <p className="mt-2 text-xs text-[#A9BCE6]">
        Acak Cepat mengunci pemain inti (yang menit mainnya paling banyak) lalu mengundi 3 pengganti tiap posisi.
        Masih bisa diubah manual per posisi di bawah.
      </p>

      <div className="mt-3"><Notice tone={notice?.tone} message={notice?.message} onDismiss={() => setNotice(null)} /></div>

      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {defs.filter((d) => d.slotId !== 'COACH').map((def) => {
          const slot = state.compose.slots[def.slotId] ?? { starterId: null, candidateIds: [] };
          const starter = slot.starterId ? entityMap.get(slot.starterId) : null;
          const blockedIds = (() => {
            const set = new Set(usedByGroup[def.group] ?? []);
            if (slot.starterId) set.delete(slot.starterId);
            for (const id of slot.candidateIds ?? []) set.delete(id);
            return set;
          })();
          return (
            <li key={def.slotId} className="player-card p-4" data-active={!starter}>
              <div className="flex items-center gap-3">
                <span className="font-display text-lg font-extrabold uppercase text-[#FFC531]">{def.slotId}</span>
                {starter ? <Avatar name={starter.name} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold">{starter ? starter.name : 'Belum ada pemain inti'}</p>
                  {starter && (
                    <p className="tnum text-xs text-[#A9BCE6]">
                      {starter.subPosition} · {formatEuro(starter.price)} · {starter.minutes ?? 0}' musim lalu
                    </p>
                  )}
                </div>
                {slot.mode && <Badge>{slot.mode === 'AUTO' ? 'Oto' : slot.mode === 'RANDOM' ? 'Acak' : 'Manual'}</Badge>}
              </div>
              <label className="mt-2 block text-sm">Pemain inti
                <select value={slot.starterId ?? ''} onChange={(e) => actions.setStarter(def.slotId, e.target.value || null)}
                  className="mt-1 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3">
                  <option value="">Pilih pemain inti</option>
                  {(byGroup[def.group] ?? []).filter((p) => !blockedIds.has(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}, {p.subPosition} {formatEuro(p.price)} ({p.minutes}')</option>
                  ))}
                </select>
              </label>
              <PenggantiSearch
                def={def}
                saved={(slot.candidateIds ?? []).filter(Boolean)}
                targets={targets}
                clubId={clubId}
                blockedIds={blockedIds}
                entityMap={entityMap}
                onSave={(ids) => {
                  const r = actions.setCandidates(def.slotId, ids);
                  if (!r.ok) setNotice({ tone: 'error', message: r.message });
                  else setNotice({ tone: 'success', message: `Pengganti ${def.slotId} tersimpan.` });
                  return r.ok;
                }}
              />
            </li>
          );
        })}
      </ul>

      <CoachEditor state={state} actions={actions} entityMap={entityMap} setNotice={setNotice} coaches={coaches} clubId={clubId} coachesFailed={(datasetIssues ?? []).includes('coaches')} onReloadDataset={onReloadDataset} />
    </section>
  );
}

// Pencarian pengganti lintas klub: ketik nama pemain atau klub, yang cocok
// posisi tampil lebih dulu. Id yang sudah dipakai slot se-grup disembunyikan.
// Tiga pilihan tersimpan sebagai satu paket.
function PenggantiSearch({ def, saved, targets, clubId, blockedIds, entityMap, onSave }) {
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState(saved);
  useEffect(() => { setDraft(saved); }, [saved.join('|')]);

  const compatOf = (p) => {
    const r = isCompatible(p, def);
    if (!r.ok) return 'Tidak cocok';
    return r.factor === 1 ? 'Cocok' : 'Sebagian';
  };

  const results = useMemo(() => {
    const query = normText(q.trim());
    const picked = new Set(draft);
    const blocked = blockedIds ?? new Set();
    // Hanya yang cocok (penuh/sebagian) yang ditampilkan; tak cocok disembunyikan.
    const pool = (targets ?? []).filter((p) =>
      p.clubId !== clubId && !picked.has(p.id) && !blocked.has(p.id) && isCompatible(p, def).ok &&
      (!query || normText(p.name).includes(query) || normText(p.clubName).includes(query)));
    const rank = (p) => (p.position === def.group ? 0
      : (def.accepts?.includes(p.subPosition) || def.adjacent?.includes(p.subPosition)) ? 1 : 2);
    return [...pool]
      .sort((a, b) => rank(a) - rank(b) || (b.minutes ?? 0) - (a.minutes ?? 0) || b.price - a.price)
      .slice(0, 12);
  }, [targets, clubId, blockedIds, q, draft, def]);

  const full = draft.length >= 3;
  const dirty = draft.join('|') !== saved.join('|');
  const names = (ids) => ids.map((id) => entityMap.get(id)?.name ?? id);

  return (
    <div className="mt-3 rounded-[10px] border border-[#2A3D6E] bg-[#0A1730]/40 p-3">
      <p className="text-sm font-bold">Pengganti {def.slotId} <span className="font-normal text-[#A9BCE6]">({draft.length}/3 dari klub lain, satu pemain satu posisi)</span></p>
      <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
        {draft.map((id) => (
          <span key={id} className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[#FFC531] px-3 text-xs">
            {names([id])[0]}
            <button type="button" onClick={() => setDraft((d) => d.filter((x) => x !== id))} aria-label={`Hapus ${names([id])[0]} dari pengganti`} className="min-h-[28px] min-w-[28px] text-[#A9BCE6] hover:text-[#F7F9FF]">×</button>
          </span>
        ))}
        {draft.length === 0 && <span className="text-xs text-[#A9BCE6]">Belum ada pilihan. Cari di bawah.</span>}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nama pemain atau klub..."
        aria-label={`Cari pengganti untuk slot ${def.slotId}`}
        className="mt-2 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3 text-sm placeholder:text-[#A9BCE6]" />
      {full ? (
        <p className="mt-2 text-xs text-[#A9BCE6]">Sudah 3. Hapus satu pilihan untuk mengganti.</p>
      ) : results.length === 0 ? (
        <p className="mt-2 text-xs text-[#A9BCE6]">Tidak ada yang cocok. Coba nama atau klub lain.</p>
      ) : (
        <ul className="mt-2 max-h-56 space-y-1 overflow-auto pr-1" aria-label={`Hasil pencarian pengganti ${def.slotId}`}>
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setDraft((d) => (d.length >= 3 ? d : [...d, p.id]))}
                aria-label={`Tambah ${p.name} ke pengganti`}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-[10px] border border-[#2A3D6E] px-3 py-2 text-left text-sm hover:border-[#FFC531]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="tnum block text-xs text-[#A9BCE6]">{p.clubName ?? ''} · {p.subPosition} · {formatEuro(p.price)}</span>
                </span>
                <span className={`shrink-0 text-[11px] font-bold ${compatOf(p) === 'Cocok' ? 'text-[#57D895]' : compatOf(p) === 'Sebagian' ? 'text-[#FFC531]' : 'text-[#A9BCE6]'}`}>{compatOf(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <Button variant="ghost" disabled={!dirty || draft.length !== 3} onClick={() => { if (onSave(draft)) setQ(''); }} aria-label={`Simpan pengganti ${def.slotId}`}>
          Simpan pengganti
        </Button>
        {dirty && draft.length !== 3 && <span className="ml-2 text-xs text-[#A9BCE6]">Pilih tepat 3 baru bisa disimpan.</span>}
      </div>
    </div>
  );
}

function CoachEditor({ state, actions, entityMap, setNotice, coaches, clubId, coachesFailed, onReloadDataset }) {
  const coach = state.compose.coach;
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState([]);
  const [fallbackName, setFallbackName] = useState('');
  const savedIds = (coach?.candidateIds ?? []).join('|');

  const ownCoach = useMemo(() => (coaches ?? []).find((c) => c.clubId === clubId) ?? null, [coaches, clubId]);
  const starter = coach?.starterId ? entityMap.get(coach.starterId) : (ownCoach ?? null);

  useEffect(() => {
    const saved = (coach?.candidateIds ?? []).map((id) => entityMap.get(id)).filter(Boolean);
    setDraft(saved.map((c) => ({ key: c.id, id: c.manual ? null : c.id, name: c.name, fromClub: c.clubName ?? '', rating: c.rating, price: c.price })));
  }, [savedIds]);

  const pool = useMemo(() => (coaches ?? []).filter((c) => c.clubId !== clubId), [coaches, clubId]);
  const [scope, setScope] = useState('rekomendasi');
  const scoped = useMemo(() => {
    if (scope === 'freeagent') return pool.filter((c) => c.freeAgent);
    if (scope === 'semua') return pool;
    return pool.filter((c) => c.freeAgent).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6);
  }, [pool, scope]);
  const results = useMemo(() => {
    const query = normText(q.trim());
    const picked = new Set(draft.map((d) => normText(d.name)));
    if (starter) picked.add(normText(starter.name));
    const base = query ? pool : scoped;
    return base
      .filter((c) => !picked.has(normText(c.name)) && (!query || normText(c.name).includes(query) || normText(c.clubName).includes(query)))
      .slice(0, 10);
  }, [pool, scoped, q, draft, starter]);

  const addId = (c) => {
    setDraft((d) => (d.length >= 3 || d.some((x) => x.key === c.id) ? d : [...d, { key: c.id, id: c.id, name: c.name, fromClub: c.clubName ?? '' }]));
  };
  const addManual = (coachName) => {
    const nm = coachName.trim();
    if (!nm) return;
    setDraft((d) => (d.length >= 3 || d.some((x) => normText(x.name) === normText(nm)) ? d : [...d, { key: `manual|${nm}|${Date.now()}`, id: null, name: nm, fromClub: '', rating: 75, price: 10 }]));
  };
  const setManual = (key, patch) => setDraft((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const save = () => {
    if (draft.length !== 3) { setNotice({ tone: 'error', message: 'Pilih tepat 3 pengganti pelatih.' }); return; }
    const res = actions.setCoach({
      starterId: starter && !starter.manual ? starter.id : undefined,
      starterName: starter && !starter.manual ? undefined : (fallbackName.trim() || starter?.name || ''),
      candidateIds: draft.filter((d) => d.id).map((d) => d.id),
      manualCandidates: draft.filter((d) => !d.id).map((d) => ({ name: d.name, rating: d.rating ?? 75, price: d.price ?? 10 })),
    });
    if (!res.ok) setNotice({ tone: 'error', message: res.message });
    else { setNotice({ tone: 'success', message: 'Pelatih tersimpan.' }); setQ(''); setFallbackName(''); }
  };

  return (
    <div className="player-card mt-4 p-4" aria-label="Editor pelatih">
      <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#FFC531]">
        Pelatih (posisi ke-12){starter ? `: ${starter.name}` : ''}
      </h2>
      <p className="mt-1 text-xs text-[#A9BCE6]">
        Pelatih kepala otomatis mengikuti klub ini. Pengganti diambil dari klub lain.
        Entri ketikan sendiri boleh isi rating dan harga.
        {(coaches ?? []).length > 0 && <span> {pool.length} pelatih tersedia.</span>}
      </p>
      {coachesFailed && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#C93A2E] p-3 text-sm">
          <span className="flex-1">Daftar pelatih gagal dimuat dari data.</span>
          <Button variant="ghost" onClick={onReloadDataset} aria-label="Muat ulang data">Muat Ulang</Button>
        </div>
      )}
      <div className="mt-3 rounded-[10px] border border-[#2A3D6E] bg-[#0A1730]/40 p-3" aria-label="Pelatih kepala (otomatis)">
        <p className="text-sm font-bold">Pelatih kepala (otomatis dari klub ini)</p>
        {starter ? (
          <p className="tnum mt-1 text-sm">
            {starter.name}
            <span className="text-[#A9BCE6]">
              {starter.clubName ? ` · ${starter.clubName}` : ''} · {formatEuro(starter.price ?? 0)}
            </span>
          </p>
        ) : (
          <label className="mt-1 block text-sm">Nama pelatih (data klub ini kosong)
            <input value={fallbackName} onChange={(e) => setFallbackName(e.target.value)} placeholder="cth. Mikel Arteta"
              className="mt-1 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3" />
          </label>
        )}
      </div>
      <div className="mt-3 rounded-[10px] border border-[#2A3D6E] p-3">
        <p className="text-sm font-bold">Pengganti pelatih ({draft.length}/3, dari klub lain)</p>
        <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
          {draft.map((d) => {
            const ent = d.id ? entityMap.get(d.id) : null;
            return (
              <span key={d.key} className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[#FFC531] px-3 text-xs">
                {d.name}{d.fromClub ? ` (${d.fromClub})` : ''} · {formatEuro(d.id ? (ent?.price ?? 0) : (d.price ?? 10))}
                <button type="button" onClick={() => setDraft((x) => x.filter((y) => y.key !== d.key))} aria-label={`Hapus ${d.name} dari pengganti pelatih`} className="min-h-[28px] min-w-[28px] text-[#A9BCE6] hover:text-[#F7F9FF]">×</button>
              </span>
            );
          })}
          {draft.length === 0 && <span className="text-xs text-[#A9BCE6]">Belum ada pilihan. Cari di bawah atau ketik manual.</span>}
        </div>
        {draft.some((d) => !d.id) && (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {draft.filter((d) => !d.id).map((d) => (
              <fieldset key={d.key} className="rounded-[10px] border border-[#2A3D6E] p-2">
                <legend className="px-1 text-[11px] font-bold">{d.name} (ketikan sendiri)</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px]">Rating
                    <input type="number" min={1} max={99} value={d.rating ?? 75} onChange={(e) => setManual(d.key, { rating: Number(e.target.value) })}
                      aria-label={`Rating ${d.name}`} className="mt-1 min-h-[40px] w-full rounded-lg border border-[#2A3D6E] bg-[#0A1730] px-2 text-sm" />
                  </label>
                  <label className="text-[11px]">€M
                    <input type="number" min={0} step={0.5} value={d.price ?? 10} onChange={(e) => setManual(d.key, { price: e.target.value === '' ? '' : Number(e.target.value) })}
                      aria-label={`Harga ${d.name}`} className="mt-1 min-h-[40px] w-full rounded-lg border border-[#2A3D6E] bg-[#0A1730] px-2 text-sm" />
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter pelatih">
          {[['rekomendasi', 'Saran'], ['freeagent', 'Tanpa klub'], ['semua', 'Semua']].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setScope(v)} aria-pressed={scope === v}
              className={`min-h-[40px] rounded-[10px] border px-3 text-xs font-bold ${scope === v ? 'border-[#FFC531] text-[#FFC531]' : 'border-[#2A3D6E] text-[#A9BCE6]'}`}>
              {label}{v === 'rekomendasi' ? '' : ` (${v === 'freeagent' ? pool.filter((c) => c.freeAgent).length : pool.length})`}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pelatih klub lain, atau ketik nama..."
            aria-label="Cari pelatih klub lain atau ketik nama"
            className="min-h-[44px] flex-1 rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3 text-sm placeholder:text-[#A9BCE6]" />
          <Button variant="ghost" disabled={!q.trim()} onClick={() => { addManual(q.trim()); setQ(''); }} aria-label="Tambah nama ketikan ke pengganti pelatih">Tambah</Button>
        </div>
        {draft.length < 3 ? (
          results.length === 0 ? (
            <p className="mt-2 text-xs text-[#A9BCE6]">Tidak ada yang cocok. Coba nama lain, ketik manual, atau ganti filter.</p>
          ) : (
            <>
              {scope === 'rekomendasi' && !q.trim() && (
                <p className="mt-2 text-xs font-bold text-[#FFC531]">Saran tanpa klub (terbaik dulu):</p>
              )}
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto pr-1" aria-label={scope === 'rekomendasi' && !q.trim() ? 'Saran tanpa klub' : 'Hasil pencarian pelatih'}>
              {results.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => addId(c)}
                    aria-label={`Tambah ${c.name} ke pengganti pelatih`}
                    className="flex min-h-[44px] w-full items-center gap-2 rounded-[10px] border border-[#2A3D6E] px-3 py-2 text-left text-sm hover:border-[#FFC531]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{c.name}{c.freeAgent ? ' (tanpa klub)' : ''}</span>
                      <span className="tnum block text-xs text-[#A9BCE6]">{c.clubName} · {c.age} th{c.nationality ? ` · ${c.nationality}` : ''} · {formatEuro(c.price ?? 0)}</span>
                    </span>
                  </button>
                </li>
              ))}
              </ul>
            </>
          )
        ) : (
          <p className="mt-2 text-xs text-[#A9BCE6]">Sudah 3. Hapus satu pilihan untuk mengganti.</p>
        )}
      </div>
      <div className="mt-3"><Button onClick={save} variant="ghost" aria-label="Simpan pelatih">Simpan Pelatih</Button></div>
      {coach && (
        <p className="mt-2 text-xs text-[#57D895]">
          Pengganti: {(coach.candidateIds ?? []).map((id) => entityMap.get(id)?.name).join(', ')}
        </p>
      )}
    </div>
  );
}
