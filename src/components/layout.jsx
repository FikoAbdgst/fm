import { formatEuro } from '../utils/format.js';

const PHASES = [
  { id: 'SETUP', label: 'Siapkan' },
  { id: 'COMPOSE', label: 'Susun Tim' },
  { id: 'DRAFT', label: 'Main' },
  { id: 'REVIEW', label: 'Hasil' },
];

export function AppShell({ children, phase, managersView, club, progress }) {
  const turnLabel = progress && phase === 'DRAFT'
    ? `Giliran ${Math.min(progress.done + 1, progress.total)}/${progress.total}`
    : null;
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-16 sm:px-6">
      <header className="scorebug mt-4 flex flex-wrap items-center gap-3 p-4">
        <span className="scorebug-slash" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-extrabold uppercase leading-none tracking-wide">
            Menjadi Manager{club ? <span>: {club.name}</span> : ''}
          </p>
          {turnLabel && (
            <p className="tnum mt-1 font-display text-3xl font-extrabold leading-none text-[#FFC531]">{turnLabel}</p>
          )}
        </div>
        {phase === 'DRAFT' && <span className="live-dot" data-on="true" aria-label="Siaran langsung" />}
        {managersView && managersView.length > 0 && <TeamsBudgetBar managers={managersView} />}
      </header>
      <PhaseStepper phase={phase} />
      <main className="mt-6">{children}</main>
      <footer className="mt-12 border-t border-[#2A3D6E] pt-4 text-xs text-[#A9BCE6]">
        <p>Data Transfermarkt untuk simulasi fan-made. Tanpa logo atau foto resmi.</p>
      </footer>
    </div>
  );
}

export function PhaseStepper({ phase }) {
  const order = ['SETUP', 'COMPOSE', 'DRAFT', 'REVIEW'];
  const idx = order.indexOf(phase);
  return (
    <nav aria-label="Tahapan permainan" className="mt-3">
      <ol className="grid grid-cols-4 gap-2">
        {PHASES.map((p, i) => {
          const done = i < idx;
          const active = p.id === phase;
          return (
            <li
              key={p.id}
              aria-current={active ? 'step' : undefined}
              data-active={active}
              data-done={done && !active}
              className="ticker-seg px-3 py-2 text-center font-display text-sm font-bold uppercase tracking-wide"
            >
              {i + 1}. {p.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function TeamsBudgetBar({ managers }) {
  return (
    <div className="flex flex-wrap gap-2" role="status" aria-label="Dana tiap manager">
      {managers.map((m) => (
        <div key={m.id} className="rounded-xl bg-[#0A1730]/60 px-3 py-2 text-right">
          <p className="font-display text-[11px] font-bold uppercase tracking-widest" style={{ color: m.color }}>{m.name}</p>
          <p className="tnum font-display text-xl font-extrabold text-[#FFC531]">{formatEuro(m.budget)}</p>
          <p className="text-[11px] text-[#A9BCE6]">{m.filled}/12 terisi</p>
        </div>
      ))}
    </div>
  );
}
