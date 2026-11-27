/** Heard mark: amber rounded square with two caption lines. Mirrors public/icon/*.png. */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--color-accent)" />
      <rect x="7" y="13" width="18" height="3.2" rx="1.6" fill="var(--color-accent-ink)" />
      <rect x="10" y="19" width="12" height="3.2" rx="1.6" fill="var(--color-accent-ink)" opacity="0.75" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <Logo size={26} />
      <span className="text-[15px] font-semibold tracking-tight text-ink-100">Heard</span>
    </div>
  );
}
