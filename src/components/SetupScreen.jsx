import { useMemo, useState } from 'react';
import { GAME, FORMATIONS } from '../config/game.js';
import { formatEuro, normText } from '../utils/format.js';
import { Button, Notice } from './common.jsx';

export function SetupScreen({ dataset, onStart }) {
  const { clubs, meta } = dataset;
  const [count, setCount] = useState(2);
  const [rows, setRows] = useState([
    { name: '', budget: GAME.budgetDefault },
    { name: '', budget: GAME.budgetDefault },
  ]);
  const [clubId, setClubId] = useState('');
  const [league, setLeague] = useState('Semua');
  const [clubQuery, setClubQuery] = useState('');
  const [sameBudget, setSameBudget] = useState(true);
  const [baseBudget, setBaseBudget] = useState(GAME.budgetDefault);
  const [formation, setFormation] = useState(GAME.formationDefault);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setCountSafe = (n) => {
    setCount(n);
    setRows((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ name: '', budget: GAME.budgetDefault });
      return next.slice(0, n);
    });
  };
  const setRow = (i, patch) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const valid = clubId
    && rows.length >= 1 && rows.length <= 5
    && rows.every((r) => r.name.trim().length >= 2 && r.name.trim().length <= 24)
    && baseBudget >= GAME.budgetMin && baseBudget <= GAME.budgetMax
    && rows.every((r) => (r.budget ?? baseBudget) >= GAME.budgetMin && (r.budget ?? baseBudget) <= GAME.budgetMax);

  const submit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    try {
      await dataset.selectClub(clubId);
      const res = onStart({
        managers: rows.map((r) => ({ name: r.name.trim(), budget: sameBudget ? baseBudget : (r.budget ?? baseBudget) })),
        config: {
          clubId, mode: 'CASUAL', modifiers: [],
          formation,
          initialBudget: baseBudget,
        },
      });
      if (res && !res.ok) setError(res.message);
    } catch (err) {
      setError(`Gagal memuat skuad klub: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const club = clubs.find((c) => c.id === clubId);
  const leagues = useMemo(() => {
    const counts = new Map();
    for (const c of clubs) counts.set(c.league || 'Lainnya', (counts.get(c.league || 'Lainnya') ?? 0) + 1);
    return [...counts.entries()];
  }, [clubs]);
  const visibleClubs = useMemo(() => {
    const q = normText(clubQuery.trim());
    return clubs.filter((c) =>
      (league === 'Semua' || (c.league || 'Lainnya') === league) &&
      (!q || normText(c.name).includes(q)));
  }, [clubs, league, clubQuery]);

  return (
    <section aria-labelledby="setup-title" className="grid gap-6">
      <div className="scorebug p-6">
        <h1 id="setup-title" className="font-display text-3xl font-extrabold uppercase leading-tight tracking-wide">
          Satu klub untuk semua manager
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-white">
          Pilih satu klub, daftarkan 1 sampai 3 manager. Semua mulai sama: pemain, pelatih, dan dana yang sama.
          Tidak ada yang menang atau kalah. Di akhir kita bandingkan racikan tiap manager.
        </p>
        <p className="mt-2 text-xs text-white/80">
          Data: Transfermarkt open-source, musim {meta.season || '…'}, cutoff {meta.cutoff || '…'}{meta.sample ? ', SAMPEL contoh, ganti via scripts/build-snapshot.mjs' : ''}.
        </p>
      </div>

      <form className="space-y-6" aria-label="Formulir setup sesi" onSubmit={submit}>
        <fieldset className="player-card p-6">
          <legend className="px-2 font-display text-sm font-bold uppercase tracking-wide">
            <span className="mr-2 inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full bg-[#FFC531] font-display font-extrabold text-[#221A03]">1</span>
            Pilih klub ({visibleClubs.length} klub)
          </legend>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter liga">
            {['Semua', ...leagues.map(([name]) => name)].map((name) => {
              const count = name === 'Semua' ? clubs.length : (leagues.find(([n]) => n === name)?.[1] ?? 0);
              return (
                <button key={name} type="button" onClick={() => setLeague(name)} aria-pressed={league === name}
                  className={`min-h-[40px] rounded-[10px] border px-3 text-sm font-bold ${league === name ? 'border-[#FFC531] text-[#FFC531]' : 'border-[#2A3D6E] text-[#A9BCE6]'}`}>
                  {name} ({count})
                </button>
              );
            })}
          </div>
          <input value={clubQuery} onChange={(e) => setClubQuery(e.target.value)} placeholder="Cari nama klub..."
            aria-label="Cari nama klub"
            className="mt-2 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3 text-sm placeholder:text-[#A9BCE6]" />
          <div className="mt-2 grid max-h-64 gap-2 overflow-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Pilih klub">
            {visibleClubs.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={clubId === c.id} onClick={() => setClubId(c.id)}
                className={`min-h-[44px] rounded-[10px] border p-3 text-left ${clubId === c.id ? 'border-[#FFC531] bg-[#1A2F5E]' : 'border-[#2A3D6E] hover:border-[#FFC531]'}`}>
                <span className={`block font-display font-bold uppercase tracking-wide ${clubId === c.id ? 'text-[#FFC531]' : ''}`}>{c.name}</span>
                <span className="block text-xs text-[#A9BCE6]">{c.league} · {c.squadSize} pemain di snapshot</span>
              </button>
            ))}
            {visibleClubs.length === 0 && (
              <p className="text-sm text-[#A9BCE6]">Tidak ada klub yang cocok. Coba kata kunci atau liga lain.</p>
            )}
          </div>
        </fieldset>
        {club && <p className="text-xs text-[#A9BCE6]">Dipilih: {club.name} ({club.league}). Pemain dan daftar belanja mengikuti klub ini.</p>}

        <fieldset className="player-card p-6">
          <legend className="px-2 font-display text-sm font-bold uppercase tracking-wide">
            <span className="mr-2 inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full bg-[#FFC531] font-display font-extrabold text-[#221A03]">2</span>
            Daftarkan manager
          </legend>
          <div>
          <span className="font-display text-sm font-bold uppercase tracking-wide">Berapa manager main</span>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Jumlah manager">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={count === n} onClick={() => setCountSafe(n)}
                className={`min-h-[44px] flex-1 rounded-[10px] border font-display text-lg font-extrabold ${count === n ? 'border-[#FFC531] bg-[#1A2F5E] text-[#FFC531]' : 'border-[#2A3D6E] text-[#A9BCE6]'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {rows.map((r, i) => (
            <fieldset key={i} className="rounded-xl border border-[#2A3D6E] p-4">
              <legend className="px-2 font-display text-sm font-bold uppercase tracking-wide">Manager {i + 1}</legend>
              <label className="text-sm">Nama
                <input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} maxLength={24}
                  placeholder={`cth. Manager ${i + 1}`} className="mt-1 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3" />
              </label>
              {!sameBudget && (
                <label className="mt-3 block text-sm">Dana khusus:
                  <span className="tnum font-display text-lg font-extrabold text-[#FFC531]"> {formatEuro(r.budget ?? baseBudget)}</span>
                  <input type="range" min={GAME.budgetMin} max={GAME.budgetMax} step={GAME.budgetStep} value={r.budget ?? baseBudget}
                    onChange={(e) => setRow(i, { budget: Number(e.target.value) })} className="mt-2 w-full accent-[#FFC531]" aria-label={`Dana manager ${i + 1}`} />
                </label>
              )}
            </fieldset>
          ))}
          </div>
        </fieldset>

        <fieldset className="player-card p-6">
          <legend className="px-2 font-display text-sm font-bold uppercase tracking-wide">
            <span className="mr-2 inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full bg-[#FFC531] font-display font-extrabold text-[#221A03]">3</span>
            Dana dan formasi
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={sameBudget} onChange={(e) => setSameBudget(e.target.checked)} className="h-5 w-5 accent-[#FFC531]" />
            Dana sama untuk semua
          </label>
          {sameBudget && (
            <label className="block text-sm">Dana awal tiap manager:
              <span className="tnum font-display text-lg font-extrabold text-[#FFC531]"> {formatEuro(baseBudget)}</span>
              <input type="range" min={GAME.budgetMin} max={GAME.budgetMax} step={GAME.budgetStep} value={baseBudget}
                onChange={(e) => setBaseBudget(Number(e.target.value))} className="mt-2 w-full accent-[#FFC531]" aria-label="Dana awal semua manager" />
            </label>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">Formasi
            <select value={formation} onChange={(e) => setFormation(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-[10px] border border-[#2A3D6E] bg-[#0A1730] px-3">
              {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <p className="text-xs text-[#A9BCE6]">
            Tiap giliran membahas satu posisi, semua pilihan terlihat.
            Jual pemain menambah dana sebesar harganya, beli pengganti mengurangi dana.
            Bisa untung kalau penggantinya lebih murah.
          </p>
        </div>
        </fieldset>

        <Notice tone="error" message={error} onDismiss={() => setError('')} />
        <Button type="submit" disabled={!valid || loading} onClick={submit} className="w-full" aria-label="Lanjut susun tim">
          {loading ? 'Memuat skuad...' : 'Lanjut Susun Tim'}
        </Button>
        {!valid && <p className="text-xs text-[#A9BCE6]">Hampir siap. Pilih klub di atas dan isi nama tiap manager, baru lanjut.</p>}
      </form>
    </section>
  );
}
