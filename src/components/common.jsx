import { useEffect } from 'react';

export function Button({ variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] px-5 font-display text-[15px] font-bold uppercase tracking-wide transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45';
  const styles = {
    primary: 'bg-[#FFC531] text-[#221A03] hover:brightness-105',
    ghost: 'border border-[#2A3D6E] bg-transparent text-[#F7F9FF] hover:border-[#FFC531]',
    keep: 'bg-[#2FBD73] text-[#04160C] hover:brightness-110',
    sell: 'bg-[#C93A2E] text-[#FFFFFF] hover:brightness-110',
  };
  return <button type="button" className={`${base} ${styles[variant] ?? styles.primary} ${className}`} {...props} />;
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'border-[#2A3D6E] text-[#A9BCE6]',
    gold: 'border-[#FFC531] text-[#FFC531]',
    keep: 'border-[#2FBD73] text-[#57D895]',
    sell: 'border-[#C93A2E] text-[#FF8A73]',
  };
  return (
    <span className={`inline-flex min-h-[28px] items-center rounded-full border px-3 text-xs font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Avatar inisial sebagai placeholder jujur (R-23): tidak menyamar sebagai foto final.
export function Avatar({ name, size = 48 }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl border border-[#2A3D6E] bg-[#0A1730] font-display font-bold text-[#FFC531]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export function Spinner({ label = 'Memuat...' }) {
  return (
    <div className="flex items-center gap-3 py-10 text-[#A9BCE6]" role="status">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#2A3D6E] border-t-[#FFC531]" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, desc, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#2A3D6E] px-6 py-12 text-center">
      <p className="font-display text-lg font-bold uppercase tracking-wide">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#A9BCE6]">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-[#C93A2E] px-6 py-10 text-center" role="alert">
      <p className="font-display text-lg font-bold uppercase tracking-wide text-[#FF8A73]">Gagal memuat data</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#A9BCE6]">{message}</p>
      <div className="mt-5">
        <Button variant="ghost" onClick={onRetry}>Coba Lagi</Button>
      </div>
    </div>
  );
}

export function Modal({ title, children, onClose, labelledBy = 'modal-title' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button type="button" aria-label="Tutup dialog" className="absolute inset-0 cursor-default bg-black/70" onClick={onClose} />
      <div className="player-card relative w-full max-w-lg p-6" data-active="true">
        <h2 id={labelledBy} className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', message, onDismiss }) {
  if (!message) return null;
  const border = tone === 'error' ? 'border-[#C93A2E]' : tone === 'success' ? 'border-[#2FBD73]' : 'border-[#FFC531]';
  return (
    <div aria-live="polite" className={`flex items-start justify-between gap-3 rounded-xl border bg-[#0A1730] px-4 py-3 text-sm ${border}`}>
      <p>{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Tutup pemberitahuan" className="min-h-[32px] min-w-[32px] text-[#A9BCE6] hover:text-[#F7F9FF]">Tutup</button>
      )}
    </div>
  );
}
