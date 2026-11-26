import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--color-ink-800)" />
      <rect x="10" y="38" width="44" height="14" rx="4" fill="var(--color-accent)" />
      <rect x="16" y="43" width="18" height="4" rx="2" fill="var(--color-accent-ink)" />
      <rect x="37" y="43" width="11" height="4" rx="2" fill="var(--color-accent-ink)" />
      <path d="M22 16c6-4 14-4 20 0M26 23c4-2.6 8-2.6 12 0" stroke="var(--color-ink-100)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Earshot home">
      <LogoMark />
      {!compact && <span className="font-display text-lg font-semibold tracking-tight text-ink-100">Earshot</span>}
    </Link>
  );
}
