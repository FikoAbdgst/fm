import { MODIFIERS } from '../config/game.js';

// Banner aturan aktif + status per manager (streak Mood Swing, menu Transfer Menu).
export function ModifierBanner({ config, managersView, state }) {
  if (!config || (config.mode !== 'HARD' && (!config.modifiers || config.modifiers.length === 0))) return null;
  const active = MODIFIERS.filter((m) => config.modifiers.includes(m.id));
  if (active.length === 0) return null;
  return (
    <section aria-label="Aturan aktif" className="player-card mt-4 p-4">
      <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#D9A441]">Aturan Aktif</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {active.map((m) => (
          <li key={m.id}>
            <span className="font-bold">{m.name}</span> <span className="text-[#9DB0A3]">{m.desc}</span>
          </li>
        ))}
      </ul>
      {managersView && (
        <ul className="mt-2 space-y-1 text-sm text-[#9DB0A3]">
          {managersView.map((m) => (
            <li key={m.id}>
              <span style={{ color: m.color }}>{m.name}</span>
              {config.modifiers.includes('TRANSFER_MENU') && (m.activeMenu ? <> menu <strong className="text-[#F2EFE4]">{m.activeMenu.menu.label}</strong></> : ' menu belum dihitung')}
              {config.modifiers.includes('MOOD_SWING') && state ? <Streak state={state} managerId={m.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Streak({ state, managerId }) {
  const hist = state.turns
    .filter((t) => t.status === 'REVEALED' && (t.decisions?.[managerId] === 'KEEP' || t.decisions?.[managerId] === 'SELL'))
    .map((t) => t.decisions[managerId]);
  if (!hist.length) return null;
  let n = 1;
  for (let i = hist.length - 1; i > 0; i--) {
    if (hist[i] === hist[i - 1]) n++;
    else break;
  }
  const last = hist[hist.length - 1] === 'KEEP' ? 'Keep' : 'Sell';
  return <span> · {last} ×{n}{n >= 2 ? ' (sama berikutnya dilarang)' : ''}</span>;
}
