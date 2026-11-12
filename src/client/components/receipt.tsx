import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Check, Delivery, Job, MoneyState, Verdict } from "../../shared/types";
import { cx, money, SeededTag, seconds, useCopy, when } from "./ui";

/* ---------- the stamp ---------- */

type StampKind = "held" | "paid" | "part" | "cancelled" | "ask" | "awaiting";

const STAMP: Record<StampKind, { word: string; cls: string }> = {
  held: { word: "Held", cls: "text-held-dot" },
  paid: { word: "Paid", cls: "text-paid" },
  part: { word: "Part paid", cls: "text-paid" },
  cancelled: { word: "Cancelled", cls: "text-ink-3" },
  ask: { word: "Your call", cls: "text-ask" },
  awaiting: { word: "Not held", cls: "text-ink-3" },
};

export function Stamp({ kind, note, className }: { kind: StampKind; note?: string; className?: string }) {
  const s = STAMP[kind];
  // Keyed by kind, so a change of state stamps again.
  return (
    <span key={kind} className={cx("stamp stamp-in", s.cls, className)}>
      {s.word}
      {note && <small>{note}</small>}
    </span>
  );
}

export function stampFor(job: Job): StampKind {
  const last = job.deliveries.at(-1);
  const map: Record<MoneyState, StampKind> = { awaiting_hold: "awaiting", held: "held", paid: "paid", part_paid: "part", cancelled: "cancelled" };
  if (job.money.state === "held" && last?.outcome === "disagreed") return "ask";
  return map[job.money.state];
}

/* ---------- one PayPal ID, printed like a receipt number ---------- */

function IdLine({ label, value, note }: { label: string; value?: string; note?: string }) {
  const { copied, copy } = useCopy(value ?? "");
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-ink-2">{label}</span>
      {value ? (
        <button onClick={copy} className="group flex min-w-0 items-baseline gap-2 text-right" aria-label={`Copy the ${label.toLowerCase()} ID`}>
          <span className="truncate">{value}</span>
          {note && <span className="shrink-0 text-ink-3">· {note}</span>}
          <span className={cx("shrink-0 text-[10.5px] tracking-[0.12em] uppercase", copied ? "text-paid" : "text-ink-3 group-hover:text-ink")}>{copied ? "Copied" : "Copy"}</span>
        </button>
      ) : (
        <span className="text-ink-3">—</span>
      )}
    </div>
  );
}

const PAYOUT_WORD: Record<string, string> = { SUCCESS: "sent", PENDING: "sending", PROCESSING: "sending", UNCLAIMED: "not claimed yet", ONHOLD: "on hold" };

/* ---------- a check's line ---------- */

type LineState = "pass" | "fail" | "ask" | "checking" | "open";

const VERDICT: Record<LineState, { word: string; cls: string }> = {
  pass: { word: "Pass", cls: "text-paid" },
  fail: { word: "Fail", cls: "text-fail" },
  ask: { word: "Split", cls: "text-ask" },
  checking: { word: "· · ·", cls: "text-held" },
  open: { word: "—", cls: "text-ink-3" },
};

function lineState(d: Delivery | undefined, id: string): LineState {
  if (!d) return "open";
  if (d.outcome === "checking") return "checking";
  const a = d.first.find((v) => v.checkId === id);
  const b = d.second?.find((v) => v.checkId === id);
  if (!a) return "open";
  if (b && a.pass !== b.pass) return "ask";
  return a.pass ? "pass" : "fail";
}

function evidence(check: Check, v: Verdict | undefined): ReactNode {
  if (!v) return null;
  const quote = v.quote && v.quote !== "none found" ? `“${v.quote.replace(/^[“"]|[”"]$/g, "")}”` : null;
  if (!v.pass) return <span className="text-fail">{v.reason}{quote && <span className="text-ink-2"> {quote}</span>}</span>;
  if (check.kind === "measured") return v.reason;
  return quote ?? v.reason;
}

export function Line({ n, check, d, print, i, compact = false }: { n: number; check: Check; d: Delivery | undefined; print: boolean; i: number; compact?: boolean }) {
  const st = lineState(d, check.id);
  const a = d?.first.find((v) => v.checkId === check.id);
  const b = d?.second?.find((v) => v.checkId === check.id);
  const v = VERDICT[st];
  return (
    <li className={cx("grid grid-cols-[22px_minmax(0,1fr)_auto] gap-x-2", compact ? "py-[4px]" : "py-[6px]", print && "print")} style={{ "--i": i } as CSSProperties}>
      <span className="text-ink-3">{String(n).padStart(2, "0")}</span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="min-w-0">{check.text}</span>
        <span className="leader" />
      </span>
      <span className={cx("font-semibold tracking-[0.08em] uppercase", v.cls, st === "checking" && "animate-pulse")}>{v.word}</span>
      {st === "ask" ? (
        <span className="col-start-2 col-end-4 mt-0.5 text-[12px] leading-snug text-ask">
          First check: {a!.pass ? "pass" : "fail"}. Second check: {b!.pass ? "pass" : "fail"}. {(a!.pass ? b : a)!.reason}
        </span>
      ) : (
        (st === "pass" || st === "fail") && <span className={cx("col-start-2 col-end-4 mt-0.5 text-[12px] leading-snug text-ink-2", compact ? "truncate" : "line-clamp-2")}>{evidence(check, a)}</span>
      )}
    </li>
  );
}

/* ---------- the receipt ---------- */

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return <span className="shrink-0 tabular-nums">{Math.max(0, (now - Date.parse(since)) / 1000).toFixed(0)} s</span>;
}

function totalLabel(state: MoneyState) {
  return { awaiting_hold: "To hold", held: "Held by PayPal", paid: "Total paid", part_paid: "Released", cancelled: "Back to the client" }[state];
}

/**
 * The job as a receipt: the brief as the agreed contract, each check as a line with its verdict
 * and evidence, PayPal's IDs, and a stamp on the total. `compact` fits it beside the home page's headline.
 */
export function Receipt({ job, compact = false }: { job: Job; compact?: boolean }) {
  const m = job.money;
  const last = job.deliveries.at(-1);
  const checking = last?.outcome === "checking";
  const amount = m.state === "part_paid" || m.state === "paid" ? m.capturedAmount ?? m.amount : m.amount;
  const kind = stampFor(job);
  const paidIn = (m.state === "paid" || m.state === "part_paid") && last?.secondsToPaid != null ? last.secondsToPaid : null;
  const printing = !!last && !checking;

  return (
    <div className={cx("receipt font-mono leading-[1.5] text-ink", compact ? "text-[12.5px] [--tear:7px] [&_.rule]:my-3" : "text-[13px]")}>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 font-serif text-[24px] font-semibold tracking-[-0.03em]">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
            <rect x="3" y="5" width="6" height="22" rx="3" fill="currentColor" />
            <rect x="23" y="5" width="6" height="22" rx="3" fill="currentColor" />
            <circle cx="16" cy="16" r="6.5" fill={kind === "paid" || kind === "part" ? "var(--color-paid-dot)" : kind === "cancelled" ? "var(--color-ink-3)" : "var(--color-held-dot)"} />
          </svg>
          held
        </div>
        <div className="mt-1.5 text-[11px] tracking-[0.14em] text-ink-2 uppercase">
          <span className="hidden sm:inline">Job receipt · </span>No. {job.id.slice(-6).toUpperCase()} · {when(job.createdAt)}
        </div>
        {job.seeded && (
          <div className="mt-2">
            <SeededTag />
          </div>
        )}
      </div>
      <hr className="rule" />
      <div className="font-serif text-[20px] leading-snug font-semibold tracking-[-0.01em]">{job.title}</div>
      {!compact && (
        <div className="mt-1 flex justify-between gap-3">
          <span className="text-ink-2">Pays</span>
          <span className="truncate">{job.freelancerEmail}</span>
        </div>
      )}
      {!compact && (
        <>
          <hr className="rule" />
          <div className="label mb-2">The brief, agreed by both sides</div>
          <p className="font-serif text-[16.5px] leading-[1.5] italic">{job.brief}</p>
        </>
      )}
      <hr className="rule" />
      <div className="label mb-1 flex justify-between">
        <span>Checks{job.deliveries.length > 1 ? ` · delivery ${job.deliveries.length}` : ""}</span>
        <span>Verdict</span>
      </div>
      {checking && (
        <div className="relative my-2 overflow-hidden rounded-[3px] bg-held-bg px-3 py-2 text-held">
          <div className="shimmer pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex justify-between gap-3">
            <span>Checking the work. If every line passes, a second check reads it again, then PayPal pays.</span>
            <Elapsed since={last!.at} />
          </div>
        </div>
      )}
      {job.checks.length === 0 && <p className="py-1.5 text-ink-3">The checks print here once the brief is read.</p>}
      <ul>
        {job.checks.map((c, i) => (
          <Line key={`${c.id}-${last?.id ?? "none"}-${last?.outcome ?? ""}`} n={i + 1} i={i} check={c} d={last} print={printing} compact={compact} />
        ))}
      </ul>
      {last?.outcome === "failed" && last.missing.length > 0 && (
        <div className="mt-2 border-l-2 border-fail pl-3 text-[12.5px]">
          <div className="label mb-1 text-fail">Still missing</div>
          <ul className="space-y-0.5">
            {last.missing.map((x) => (
              <li key={x}>– {x}</li>
            ))}
          </ul>
        </div>
      )}
      <hr className="rule" />
      <div className="label mb-1">PayPal</div>
      {!compact && <IdLine label="Order" value={m.orderId} />}
      <IdLine label="Hold" value={m.authorizationId} />
      <IdLine label="Capture" value={m.captureId} />
      <IdLine label="Payout" value={m.payoutBatchId} note={m.payoutStatus && (PAYOUT_WORD[m.payoutStatus] ?? m.payoutStatus.toLowerCase())} />
      <hr className="rule" />
      <div className={cx("relative", kind !== "awaiting" && "pt-[72px] sm:pt-0")}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold tracking-[0.1em] uppercase">{totalLabel(m.state)}</span>
          <span className={cx("text-[32px] font-medium tracking-[-0.02em] sm:text-[36px]", m.state === "cancelled" && "text-ink-3 line-through decoration-1")}>{money(amount)}</span>
        </div>
        {m.state === "part_paid" && (
          <div className="flex justify-between text-ink-2">
            <span>Of the held</span>
            <span>{money(m.amount)}</span>
          </div>
        )}
        {paidIn != null && (
          <div className="flex justify-between text-ink-2">
            <span>Delivery to paid</span>
            <span>{seconds(paidIn)}</span>
          </div>
        )}
        {kind !== "awaiting" && (
          <div
            className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 text-[26px] sm:-top-1 sm:left-[33%] sm:translate-x-0 sm:text-[30px]"
            style={printing ? ({ "--stamp-delay": `${job.checks.length * 110 + 150}ms` } as CSSProperties) : undefined}
          >
            <Stamp kind={kind} note={kind === "paid" && paidIn != null ? `in ${seconds(paidIn)}` : kind === "held" && m.heldAt ? when(m.heldAt) : undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- what happened, in order ---------- */

const failedWords = (n: number) => (n === 1 ? "1 check failed" : `${n} checks failed`);

export function Timeline({ job }: { job: Job }) {
  const m = job.money;
  const items: { at?: string; text: ReactNode; tone: string }[] = [{ at: job.createdAt, text: "Checks agreed", tone: "bg-ink" }];
  if (m.heldAt) items.push({ at: m.heldAt, text: <>{money(m.amount)} held by PayPal</>, tone: "bg-held-dot" });
  job.deliveries.forEach((d, i) =>
    items.push({
      at: d.at,
      text: (
        <>
          Delivery {i + 1}: {d.outcome === "passed" ? "every check passed" : d.outcome === "failed" ? failedWords(d.first.filter((v) => !v.pass).length) : d.outcome === "disagreed" ? "the two checks disagreed" : "being checked"}
        </>
      ),
      tone: d.outcome === "passed" ? "bg-paid-dot" : d.outcome === "failed" ? "bg-fail" : d.outcome === "disagreed" ? "bg-ask" : "bg-held-dot",
    }),
  );
  if (m.paidAt) items.push({ at: m.paidAt, text: m.state === "part_paid" ? <>{money(m.capturedAmount)} released</> : <>{money(m.capturedAmount ?? m.amount)} paid to the freelancer</>, tone: "bg-paid-dot" });
  if (m.cancelledAt) items.push({ at: m.cancelledAt, text: "Hold cancelled", tone: "bg-ink-3" });
  return (
    <ol className="border-l-[1.5px] border-line font-mono text-[12.5px]">
      {items.map((it, i) => (
        <li key={i} className="relative pb-4 pl-4 last:pb-0">
          <span className={cx("absolute top-[6px] -left-[5px] h-2 w-2 rounded-full", it.tone)} />
          <div className="text-ink">{it.text}</div>
          <div className="text-ink-3">{it.at ? new Date(it.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : ""}</div>
        </li>
      ))}
    </ol>
  );
}
