import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import type { Check, Delivery, Job, Verdict } from "../../shared/types";
import { cx, IdChip, money, MoneyPill, OutcomePill, seconds, SeededTag, Spinner, when } from "./ui";

/* ---------- the money ---------- */

function headline(job: Job): { title: ReactNode; text: ReactNode } {
  const m = job.money;
  const last = job.deliveries.at(-1);
  const to = <span className="font-semibold text-ink">{job.freelancerEmail}</span>;
  switch (m.state) {
    case "awaiting_hold":
      return { title: <>{money(m.amount)} not held yet</>, text: <>Approve the hold with PayPal to start the job. Nothing is taken from your account until the work passes.</> };
    case "paid":
      return {
        title: <>{money(m.capturedAmount ?? m.amount)} paid</>,
        text: m.state === "paid" && last?.outcome === "passed" ? <>Every check passed, so PayPal took the held money and sent it to {to}.</> : <>The client released the money to {to}.</>,
      };
    case "part_paid": {
      const back = Number(m.amount) - Number(m.capturedAmount ?? 0);
      return {
        title: <>{money(m.capturedAmount)} of {money(m.amount)} released</>,
        text: <>The client released part of the hold to {to}. The other {money(back.toFixed(2))} stayed with the client.</>,
      };
    }
    case "cancelled":
      return { title: <>Hold of {money(m.amount)} cancelled</>, text: <>The client cancelled the hold, so the money stayed with them. Nothing was paid.</> };
    default: {
      const fails = last?.first.filter((v) => !v.pass).length ?? 0;
      const text =
        !last ? <>Nobody has this money yet. It goes to {to} the moment every check passes.</>
        : last.outcome === "checking" ? <>Checking the latest delivery against the {job.checks.length} checks. The money stays held meanwhile.</>
        : last.outcome === "failed" ? <>The latest delivery missed {fails} of {job.checks.length} checks, so the money stays held until they pass.</>
        : last.outcome === "disagreed" ? <>The two checks disagree on this delivery, so nothing moves until the client decides.</>
        : <>Nobody has this money yet. It goes to {to} the moment every check passes.</>;
      return { title: <>{money(m.amount)} held by PayPal</>, text };
    }
  }
}

const STEPS = ["Checks agreed", "Money held", "Work delivered", "Paid"] as const;

function stepReached(job: Job): number {
  const m = job.money;
  if (m.state === "paid" || m.state === "part_paid") return 4;
  if (m.state === "awaiting_hold") return 1;
  if (m.state === "cancelled") return 2;
  return job.deliveries.length ? 3 : 2;
}

function StepRail({ job }: { job: Job }) {
  const reached = stepReached(job);
  const cancelled = job.money.state === "cancelled";
  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {STEPS.map((s, i) => {
        const done = i < reached;
        const last = i === 3;
        const label = last && cancelled ? "Cancelled" : last && job.money.state === "part_paid" ? "Part paid" : s;
        return (
          <li key={s} className="min-w-0">
            <div
              className={cx(
                "h-1.5 rounded-full",
                done ? (reached === 4 ? "bg-paid-dot" : "bg-held-dot") : last && cancelled ? "bg-ink-3/40" : "bg-line",
              )}
            />
            <div className={cx("mt-1.5 text-[12px] leading-tight font-semibold sm:text-[13px]", done ? "text-ink" : "text-ink-3")}>{label}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function MoneyCard({ job }: { job: Job }) {
  const m = job.money;
  const h = headline(job);
  const last = job.deliveries.at(-1);
  const paid = m.state === "paid" || m.state === "part_paid";
  return (
    <section className="card overflow-hidden">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MoneyPill state={m.state} />
            {last && m.state === "held" && <OutcomePill outcome={last.outcome} />}
            {job.seeded && <SeededTag />}
          </div>
          <h1 className="mt-4 text-[34px] leading-[1.05] font-[750] sm:text-[46px]">{h.title}</h1>
          {paid && last?.secondsToPaid != null && (
            <div className="mt-3 inline-flex items-baseline gap-2 rounded-xl bg-paid-bg px-3 py-1.5 text-paid">
              <span className="text-[22px] font-[750] tracking-[-0.02em]">Paid in {seconds(last.secondsToPaid)}</span>
              <span className="text-[13px] font-semibold">from delivery to payout</span>
            </div>
          )}
          <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-2">{h.text}</p>
          <div className="mt-6">
            <StepRail job={job} />
          </div>
        </div>
        <div className={cx("rounded-2xl border border-line-2 bg-paper/60 px-4 py-2", !m.orderId && "hidden lg:block")}>
          <div className="flex items-center justify-between pt-1 pb-1">
            <span className="label">PayPal sandbox</span>
            {m.heldAt && <span className="text-[12px] text-ink-3">held {when(m.heldAt)}</span>}
          </div>
          <div className="divide-y divide-line-2">
            <IdChip label="Order" value={m.orderId} />
            <IdChip label="Hold" value={m.authorizationId} />
            <IdChip label="Capture" value={m.captureId} />
            <IdChip label="Payout" value={m.payoutBatchId} status={m.payoutStatus} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- the checks ---------- */

function Tick({ state }: { state: "pass" | "fail" | "ask" | "wait" }) {
  const map = {
    pass: ["bg-paid-dot text-white", "✓"],
    fail: ["bg-fail text-white", "✕"],
    ask: ["bg-ask text-white", "?"],
    wait: ["bg-line text-ink-3", "·"],
  } as const;
  const [cls, ch] = map[state];
  return <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-black", cls)}>{ch}</span>;
}

function KindTag({ kind }: { kind: Check["kind"] }) {
  return (
    <span className="shrink-0 rounded-md bg-line-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2" title={kind === "measured" ? "Counted by code, not by the model" : "Decided by the AI check, with a quote"}>
      {kind === "measured" ? "Measured" : "Judged"}
    </span>
  );
}

function stateOf(d: Delivery | undefined, id: string): "pass" | "fail" | "ask" | "wait" {
  if (!d || d.outcome === "checking") return "wait";
  const a = d.first.find((v) => v.checkId === id);
  const b = d.second?.find((v) => v.checkId === id);
  if (!a) return "wait";
  if (b && a.pass !== b.pass) return "ask";
  return a.pass ? "pass" : "fail";
}

export function CheckList({ job }: { job: Job }) {
  const last = job.deliveries.at(-1);
  const passing = last ? job.checks.filter((c) => stateOf(last, c.id) === "pass").length : 0;
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold">The checks</h2>
        <span className="text-[13px] text-ink-3">{last && last.outcome !== "checking" ? `${passing} of ${job.checks.length} pass` : "Agreed before the hold"}</span>
      </div>
      <ul className="mt-3 divide-y divide-line-2">
        {job.checks.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <Tick state={stateOf(last, c.id)} />
            <span className="min-w-0 flex-1 text-[15px]">{c.text}</span>
            <KindTag kind={c.kind} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- a delivery and its verdicts ---------- */

function Quote({ children, tone }: { children: ReactNode; tone: "pass" | "fail" | "ask" }) {
  return (
    <blockquote
      className={cx(
        "mt-1 border-l-[3px] pl-3 text-[14px] leading-relaxed text-ink-2",
        tone === "pass" ? "border-paid-dot/50" : tone === "fail" ? "border-fail/60" : "border-ask/60",
      )}
    >
      {children}
    </blockquote>
  );
}

function VerdictRow({ check, a, b }: { check: Check; a?: Verdict; b?: Verdict }) {
  const disagree = !!(a && b && a.pass !== b.pass);
  const tone = disagree ? "ask" : a?.pass ? "pass" : "fail";
  return (
    <li className="flex gap-3 py-3">
      <Tick state={disagree ? "ask" : a?.pass ? "pass" : "fail"} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{check.text}</div>
        {disagree ? (
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {[
              ["First check", a!],
              ["Second check", b!],
            ].map(([who, v]) => (
              <div key={who as string} className="rounded-xl bg-ask-bg/60 px-3 py-2">
                <div className="text-[12px] font-bold text-ask">
                  {who as string}: {(v as Verdict).pass ? "pass" : "not yet"}
                </div>
                <Quote tone="ask">{(v as Verdict).quote}</Quote>
                {(v as Verdict).reason && <div className="mt-1 text-[13px] text-ink-2">{(v as Verdict).reason}</div>}
              </div>
            ))}
          </div>
        ) : (
          a && (
            <>
              <Quote tone={tone}>{a.quote}</Quote>
              {!a.pass && a.reason && <div className="mt-1 text-[13.5px] font-semibold text-fail">{a.reason}</div>}
            </>
          )
        )}
      </div>
    </li>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return <span className="ml-auto shrink-0 font-mono text-[15px] font-semibold text-ink tabular-nums">{Math.max(0, (now - Date.parse(since)) / 1000).toFixed(0)} s</span>;
}

export function DeliveryCard({ job, d, n, latest }: { job: Job; d: Delivery; n: number; latest: boolean }) {
  const [open, setOpen] = useState(false);
  const [verdicts, setVerdicts] = useState(latest);
  const fails = d.first.filter((v) => !v.pass).length;
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 px-5 py-3.5 sm:px-6">
        <div className="min-w-0">
          <div className="text-[15px] font-bold">Delivery {n}</div>
          <div className="text-[13px] text-ink-3">
            {d.label} · {when(d.at)}
          </div>
        </div>
        <OutcomePill outcome={d.outcome} />
      </header>
      <div className="px-5 pt-3 sm:px-6">
        <button onClick={() => setOpen((v) => !v)} className="w-full text-left">
          <div className="rounded-xl bg-paper px-3.5 py-2.5 font-serif text-[14.5px] leading-relaxed text-ink-2">
            <p className={cx(!open && "line-clamp-2")}>{d.excerpt}</p>
          </div>
          <span className="mt-1 inline-block text-[12.5px] font-semibold text-ink-3">{open ? "Show less" : "Show more of the delivery"}</span>
        </button>
      </div>
      {d.outcome === "checking" ? (
        <div className="flex gap-3 px-5 py-5 text-[15px] leading-relaxed text-ink-2 sm:px-6">
          <Spinner className="mt-1 shrink-0 text-held" />
          <span>
            <span className="font-semibold text-ink">Checking the work against the {job.checks.length} checks.</span> If every one passes, a second, separate check reads it
            again, and then PayPal pays.
          </span>
          <Elapsed since={d.at} />
        </div>
      ) : !verdicts ? (
        <button onClick={() => setVerdicts(true)} className="mx-5 my-4 flex w-[calc(100%-2.5rem)] items-center justify-between rounded-xl border border-line px-4 py-2.5 text-left text-[14px] sm:mx-6 sm:w-[calc(100%-3rem)]">
          <span className="text-ink-2">
            {d.outcome === "failed" ? `Missed ${fails} of ${job.checks.length} checks` : d.outcome === "disagreed" ? "The two checks disagreed" : `Passed all ${job.checks.length} checks`}
          </span>
          <span className="font-semibold text-ink">Show each check</span>
        </button>
      ) : (
        <ul className="divide-y divide-line-2 px-5 sm:px-6">
          {job.checks.map((c) => (
            <VerdictRow key={c.id} check={c} a={d.first.find((v) => v.checkId === c.id)} b={d.second?.find((v) => v.checkId === c.id)} />
          ))}
        </ul>
      )}
      {verdicts && d.outcome === "failed" && d.missing.length > 0 && (
        <div className="mx-5 mb-5 rounded-xl border border-fail/20 bg-fail-bg/50 px-4 py-3 sm:mx-6">
          <div className="text-[14px] font-bold text-fail">What's still missing</div>
          <ul className="mt-1 list-disc pl-5 text-[14.5px] leading-relaxed text-ink">
            {d.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="mt-1.5 text-[13px] text-ink-2">The money stays held. Deliver again when it's fixed.</div>
        </div>
      )}
      {verdicts && d.outcome === "disagreed" && (
        <div className="mx-5 mb-5 rounded-xl border border-ask/20 bg-ask-bg/60 px-4 py-3 text-[14.5px] sm:mx-6">
          <span className="font-bold text-ask">The two checks disagree, so no money moves.</span> The client decides: release the money, or wait for another delivery.
        </div>
      )}
      {d.outcome === "passed" && (
        <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paid-bg px-4 py-3 text-[14.5px] text-paid sm:mx-6">
          <span className="font-bold">Both checks passed every item.</span>
          {d.secondsToPaid != null && <span className="font-semibold">Paid {seconds(d.secondsToPaid)} later</span>}
        </div>
      )}
    </article>
  );
}

/* ---------- what each side can do ---------- */

export type DeliverInput = { kind: "text"; text: string } | { kind: "file"; file: File } | { kind: "link"; url: string };
export type Busy = "deliver" | "release" | "cancel" | null;

export type JobActions = {
  deliver: (input: DeliverInput) => void;
  deliverExample?: (which: "unfinished" | "finished") => void;
  releaseAll: () => void;
  releasePart: (amount: string) => void;
  cancel: () => void;
  busy: Busy;
  error: string | null;
  /** Set when today's live checks are used up: the sentence to show. */
  cap: string | null;
};

function Side({ who, title, children }: { who: string; title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="label">{who}</div>
      <h2 className="mt-1 text-[18px] font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Deliver({ job, actions }: { job: Job; actions: JobActions }) {
  const [tab, setTab] = useState<"text" | "file" | "link">("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const checking = actions.busy === "deliver" || job.deliveries.at(-1)?.outcome === "checking";
  const can = !actions.busy && !checking;

  if (job.money.state === "awaiting_hold") return <p className="text-[14.5px] text-ink-2">You can deliver once the client has placed the hold.</p>;
  if (actions.cap) return <p className="rounded-xl bg-held-bg px-3.5 py-3 text-[14.5px] text-held">{actions.cap}</p>;

  const input: DeliverInput | null =
    tab === "text" ? (text.trim() ? { kind: "text", text } : null) : tab === "file" ? (file ? { kind: "file", file } : null) : url.trim() ? { kind: "link", url } : null;

  return (
    <>
      {actions.deliverExample && (
        <div className="mb-4 grid gap-2">
          <button className="btn btn-quiet justify-start" disabled={!can} onClick={() => actions.deliverExample!("unfinished")}>
            <span className="h-2 w-2 rounded-full bg-fail" /> Deliver the unfinished example
          </button>
          <button className="btn btn-quiet justify-start" disabled={!can} onClick={() => actions.deliverExample!("finished")}>
            <span className="h-2 w-2 rounded-full bg-paid-dot" /> Deliver the finished example
          </button>
          <div className="pt-1 text-center text-[12.5px] text-ink-3">or deliver your own</div>
        </div>
      )}
      <div className="mb-2 flex rounded-xl bg-line-2 p-1 text-[13.5px] font-semibold">
        {(
          [
            ["text", "Paste text"],
            ["file", "File"],
            ["link", "Link"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("flex-1 rounded-lg py-1.5", tab === k ? "bg-card text-ink shadow-sm" : "text-ink-2")}>
            {l}
          </button>
        ))}
      </div>
      {tab === "text" && <textarea className="field min-h-32" placeholder="Paste the finished work here" value={text} onChange={(e) => setText(e.target.value)} />}
      {tab === "file" && (
        <label className="field flex cursor-pointer flex-col items-center gap-1 border-dashed py-6 text-center text-[14px] text-ink-2">
          <input type="file" className="sr-only" accept=".txt,.md,.pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="font-semibold text-ink">{file ? file.name : "Choose a file"}</span>
          <span className="text-[12.5px] text-ink-3">Text, PDF, PNG or JPG</span>
        </label>
      )}
      {tab === "link" && <input className="field" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />}
      <button
        className="btn mt-3 w-full"
        disabled={!can || !input}
        onClick={() => {
          actions.deliver(input!);
          setText("");
          setUrl("");
          setFile(null);
        }}
      >
        {checking ? (
          <>
            <Spinner /> Checking the work
          </>
        ) : (
          "Deliver for checking"
        )}
      </button>
    </>
  );
}

export function ActionPanel({ job, actions, hold }: { job: Job; actions: JobActions; hold: ReactNode }) {
  const [part, setPart] = useState("");
  const st = job.money.state;
  const last = job.deliveries.at(-1);
  const disagreed = last?.outcome === "disagreed";
  const busy = !!actions.busy || last?.outcome === "checking";

  if (st === "paid" || st === "part_paid" || st === "cancelled")
    return (
      <section className="card p-5 text-[15px] text-ink-2">
        <div className="label">This job is closed</div>
        <p className="mt-2">
          {st === "cancelled" ? "The hold was cancelled. Nothing more can be delivered or paid here." : "The money has moved. Nothing more can be delivered or released here."}
        </p>
        <Link href="/new" className="btn btn-quiet mt-4 w-full">
          Start a new job
        </Link>
      </section>
    );

  const error = actions.error && <p className="rounded-xl bg-fail-bg px-3.5 py-3 text-[14px] text-fail">{actions.error}</p>;
  const freelancer = (
    <Side who="Freelancer" title="Deliver the work">
      <Deliver job={job} actions={actions} />
    </Side>
  );

  if (st === "awaiting_hold")
    return (
      <div className="flex flex-col gap-4">
        <Side who="Client" title={`Hold ${money(job.money.amount)} with PayPal`}>
          <p className="mb-4 text-[14.5px] leading-relaxed text-ink-2">PayPal sets the money aside. Nothing is taken until the work passes or you release it.</p>
          {hold}
        </Side>
        {freelancer}
        {error}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {freelancer}
      <Side who="Client" title={disagreed ? "The checks disagree: you decide" : "Your money, your call"}>
        <div className="grid gap-2">
          <button className={cx("btn", !disagreed && "btn-quiet")} disabled={busy} onClick={actions.releaseAll}>
            {actions.busy === "release" ? (
              <>
                <Spinner /> Asking PayPal
              </>
            ) : (
              <>Release {money(job.money.amount)} now</>
            )}
          </button>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">$</span>
              <input className="field pl-6" inputMode="decimal" placeholder="Amount" value={part} onChange={(e) => setPart(e.target.value.replace(/[^0-9.]/g, ""))} />
            </div>
            <button
              className="btn btn-quiet"
              disabled={busy || !(Number(part) > 0 && Number(part) < Number(job.money.amount))}
              onClick={() => actions.releasePart(Number(part).toFixed(2))}
            >
              Release part
            </button>
          </div>
          <button className="btn btn-danger" disabled={busy} onClick={actions.cancel}>
            {actions.busy === "cancel" ? (
              <>
                <Spinner /> Asking PayPal
              </>
            ) : (
              "Cancel the hold"
            )}
          </button>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          Releasing pays the freelancer now, whatever the checks say. Cancelling gives up the hold, so the money stays with you.
        </p>
      </Side>
      {error}
    </div>
  );
}

export function ShareLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof location !== "undefined" ? `${location.origin}/j/${id}` : `/j/${id}`;
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"
    >
      {copied ? "Link copied" : "Copy the link: one page for both sides"}
    </button>
  );
}
