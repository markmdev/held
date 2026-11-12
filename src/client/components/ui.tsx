import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import type { DeliveryOutcome, MoneyState } from "../../shared/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** The name mark: the client's money held between two sides until the work passes. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="3" y="5" width="6" height="22" rx="3" fill="currentColor" />
      <rect x="23" y="5" width="6" height="22" rx="3" fill="currentColor" />
      <circle cx="16" cy="16" r="6.5" fill="var(--color-held-dot)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <Mark size={26} />
      <span className="text-[21px] leading-none font-[750] tracking-[-0.04em]">held</span>
    </span>
  );
}

const NAV = [
  { href: "/new", label: "New job" },
  { href: "/ledger", label: "Ledger" },
  { href: "/results", label: "Accuracy" },
];

export function TopBar() {
  const [path] = useLocation();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Held, home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "rounded-lg px-2.5 py-2 text-[14px] font-semibold transition sm:px-3",
                path.startsWith(n.href) ? "bg-card text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
          <span className="ml-1 hidden rounded-full border border-dashed border-ink-3/60 px-2.5 py-1 text-[12px] font-semibold text-ink-2 sm:inline">
            Test mode
          </span>
        </nav>
      </div>
    </header>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className={cx("mx-auto px-4 pt-6 pb-20 sm:px-6 sm:pt-10", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 text-[13px] text-ink-3 sm:px-6">
        <span className="flex items-center gap-2">
          <Mark size={16} /> Held · paid the minute the work passes
        </span>
        <span>Test mode: payments run in PayPal's sandbox, so no real money moves.</span>
      </footer>
    </div>
  );
}

export function money(amount: string | undefined) {
  if (!amount) return "–";
  const n = Number(amount);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0 });
}

export function seconds(n: number | null | undefined) {
  if (n == null) return "–";
  if (n < 90) return `${Math.round(n)} s`;
  const m = Math.floor(n / 60);
  return `${m} min ${Math.round(n % 60)} s`;
}

export function when(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const MONEY: Record<MoneyState, { label: string; cls: string; dot: string }> = {
  awaiting_hold: { label: "Not held yet", cls: "bg-off-bg text-off", dot: "bg-ink-3" },
  held: { label: "Held", cls: "bg-held-bg text-held", dot: "bg-held-dot" },
  paid: { label: "Paid", cls: "bg-paid-bg text-paid", dot: "bg-paid-dot" },
  part_paid: { label: "Part paid", cls: "bg-paid-bg text-paid", dot: "bg-paid-dot" },
  cancelled: { label: "Cancelled", cls: "bg-off-bg text-off", dot: "bg-ink-3" },
};

export function MoneyPill({ state, className }: { state: MoneyState; className?: string }) {
  const m = MONEY[state];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold", m.cls, className)}>
      <span className={cx("h-2 w-2 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

const OUTCOME: Record<DeliveryOutcome | "none", { label: string; cls: string }> = {
  checking: { label: "Checking", cls: "bg-line-2 text-ink-2" },
  passed: { label: "Passed", cls: "bg-paid-bg text-paid" },
  failed: { label: "Not yet", cls: "bg-fail-bg text-fail" },
  disagreed: { label: "Checks disagree", cls: "bg-ask-bg text-ask" },
  none: { label: "No delivery", cls: "bg-line-2 text-ink-3" },
};

export function OutcomePill({ outcome, className }: { outcome: DeliveryOutcome | "none"; className?: string }) {
  const o = OUTCOME[outcome];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold", o.cls, className)}>
      {outcome === "checking" && <Spinner />}
      {o.label}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="5" y="5" width="8.5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10.5 3.2A1.7 1.7 0 0 0 9 2.5H4.2A1.7 1.7 0 0 0 2.5 4.2V9a1.7 1.7 0 0 0 .7 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const TickIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Copies a value and shows a tick for a moment. */
export function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: () => {
      void navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    },
  };
}

/** One of PayPal's IDs: a mono pill with a copy button, the proof that money really moved. */
export function IdChip({ label, value, status }: { label: string; value?: string; status?: string }) {
  const { copied, copy } = useCopy(value ?? "");
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2">
      <span className="shrink-0 text-[13px] text-ink-2">{label}</span>
      {value ? (
        <span className="flex min-w-0 items-center gap-1.5">
          {status && <PayoutStatus status={status} />}
          <button
            onClick={copy}
            aria-label={`Copy ${label.toLowerCase()} ID`}
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-card py-1 pr-1 pl-2.5 font-mono text-[12.5px] text-ink transition-colors duration-150 hover:border-ink-3"
          >
            <span className="truncate">{value}</span>
            <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-150", copied ? "bg-paid-dot text-white" : "bg-line-2 text-ink-2")}>
              {copied ? <TickIcon /> : <CopyIcon />}
            </span>
          </button>
        </span>
      ) : (
        <span className="text-[13px] text-ink-3">–</span>
      )}
    </div>
  );
}

const PAYOUT: Record<string, [string, string]> = {
  SUCCESS: ["Sent", "bg-paid-bg text-paid"],
  PENDING: ["Sending", "bg-held-bg text-held"],
  PROCESSING: ["Sending", "bg-held-bg text-held"],
  ONHOLD: ["On hold at PayPal", "bg-held-bg text-held"],
  UNCLAIMED: ["Not claimed yet", "bg-held-bg text-held"],
};

function PayoutStatus({ status }: { status: string }) {
  const [label, cls] = PAYOUT[status] ?? [status.charAt(0) + status.slice(1).toLowerCase(), "bg-fail-bg text-fail"];
  return <span className={cx("shrink-0 rounded px-1 font-sans text-[11px] font-bold", cls)}>{label}</span>;
}

export function SeededTag() {
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-semibold text-ink-3" title="A sample job, run through Held with PayPal's sandbox">
      Sample job
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center">
      <div className="text-[16px] font-bold">{title}</div>
      {children && <div className="mt-1 text-[14px] text-ink-2">{children}</div>}
    </div>
  );
}
