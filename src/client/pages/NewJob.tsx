import { useState, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { createJob, HeldError, makeChecks, useConfig } from "../api";
import { cx, money, Page, Spinner } from "../components/ui";
import { EXAMPLE } from "../../shared/example";
import type { Check, Job } from "../../shared/types";
import { Receipt } from "../components/receipt";

function Step({ n, title, done, muted, children }: { n: number; title: string; done?: boolean; muted?: boolean; children: ReactNode }) {
  return (
    <section className={cx("border-t-[1.5px] border-dashed border-line pt-6 pb-9 transition-opacity duration-200", muted && "opacity-50")}>
      <h2 className="flex items-baseline gap-3 text-[25px] tracking-[-0.015em]">
        <span className={cx("w-6 shrink-0 font-mono font-semibold tracking-[0.1em]", done ? "text-[17px] text-paid" : "text-[13px] text-ink-3")}>{done ? "✓" : String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Note({ tone, children }: { tone: "held" | "fail"; children: ReactNode }) {
  return <p className={cx("mt-4 border-l-2 pl-3 text-[15px] leading-relaxed", tone === "held" ? "border-held text-held" : "border-fail text-fail")}>{children}</p>;
}

export function NewJob() {
  const example = new URLSearchParams(useSearch()).has("example");
  const [, go] = useLocation();
  const config = useConfig();
  const [brief, setBrief] = useState(example ? EXAMPLE.brief : "");
  const [price, setPrice] = useState(example ? EXAMPLE.amount.replace(/\.00$/, "") : "");
  const [email, setEmail] = useState(example ? "freelancer@held.example.com" : "");
  const [title, setTitle] = useState("");
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState<"checks" | "hold" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const capNow = cap ?? (config && config.checksLeft <= 0 ? "Today's live checks are used up. Come back tomorrow, or read the finished jobs in the ledger." : null);
  const ready = !!checks && checks.length > 0 && checks.every((c) => c.text.trim()) && title.trim() && Number(price) > 0 && email.includes("@");

  function failed(e: unknown) {
    if (e instanceof HeldError && e.code === "daily_limit") setCap(e.message);
    else setError((e as Error).message);
  }

  async function draft() {
    setBusy("checks");
    setError(null);
    try {
      const d = await makeChecks(brief);
      setChecks(d.checks);
      setTitle(d.title);
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  }

  async function hold() {
    setBusy("hold");
    setError(null);
    try {
      const { id } = await createJob({ title, brief, amount: price, freelancerEmail: email, checks: checks ?? [] });
      go(`/j/${id}`);
    } catch (e) {
      failed(e);
      setBusy(null);
    }
  }

  const draftJob: Job = {
    id: "draft",
    title: title || "New job",
    brief: brief.trim() || "The brief prints here as you write it.",
    freelancerEmail: email || "—",
    createdAt: new Date().toISOString(),
    seeded: false,
    checks: checks ?? [],
    money: { state: "awaiting_hold", amount: price || "0" },
    deliveries: [],
  };

  return (
    <Page>
      <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_440px] xl:gap-20">
        <div className="min-w-0">
          <div className="font-mono text-[12px] tracking-[0.16em] text-ink-2 uppercase">New job</div>
          <h1 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.03em] sm:text-[56px]">What should be delivered?</h1>
          <p className="mt-4 mb-9 max-w-xl text-[18px] leading-[1.55] text-ink-2">
            Write it in plain words. Held turns it into checks that both of you agree before any money moves.
          </p>

          <Step n={1} title="The brief" done={!!checks}>
            <label className="label" htmlFor="brief">
              The work, as you'd tell the freelancer
            </label>
            <textarea id="brief" className="field mt-2 min-h-40 font-serif text-[17px] leading-[1.55] [field-sizing:content]" value={brief} onChange={(e) => (setBrief(e.target.value), setChecks(null))} />
            <div className="mt-5 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <label className="label" htmlFor="price">
                  Price
                </label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-ink-3">$</span>
                  <input id="price" className="field pl-7 font-mono" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="email">
                  Freelancer's PayPal email
                </label>
                <input id="email" className="field mt-2 font-mono" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <button className="btn mt-6 w-full sm:w-auto" disabled={!!busy || !brief.trim() || !!capNow} onClick={draft}>
              {busy === "checks" ? (
                <>
                  <Spinner /> Reading the brief
                </>
              ) : checks ? (
                "Turn the brief into checks again"
              ) : (
                "Turn the brief into checks"
              )}
            </button>
            {capNow && <Note tone="held">{capNow}</Note>}
            {error && !checks && <Note tone="fail">{error}</Note>}
          </Step>

          <Step n={2} title="The checks" muted={!checks}>
            {!checks ? (
              <p className="text-[16px] text-ink-2">The checks appear here. Both sides see exactly what the work will be checked against.</p>
            ) : (
              <>
                <label className="label" htmlFor="title">
                  Job title
                </label>
                <input id="title" className="field mt-2 mb-6 font-serif text-[18px]" value={title} onChange={(e) => setTitle(e.target.value)} />
                <div className="label">Checks</div>
                <ul className="mt-2 flex flex-col gap-2">
                  {checks.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2.5">
                      <span className="w-6 shrink-0 font-mono text-[13px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <textarea
                        rows={1}
                        className="field resize-none py-2 font-mono text-[14px] [field-sizing:content]"
                        value={c.text}
                        aria-label={`Check ${i + 1}`}
                        onChange={(e) => setChecks(checks.map((x) => (x.id === c.id ? { id: x.id, text: e.target.value.replace(/\n/g, " "), kind: "judged" } : x)))}
                      />
                      <span className="hidden w-[84px] shrink-0 border border-dashed border-ink-3 py-0.5 text-center font-mono text-[10.5px] tracking-[0.12em] text-ink-2 uppercase sm:inline">
                        {c.kind === "measured" ? "Measured" : "Judged"}
                      </span>
                      <button
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[3px] text-ink-3 hover:bg-line-2 hover:text-fail"
                        aria-label="Remove this check"
                        onClick={() => setChecks(checks.filter((x) => x.id !== c.id))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-4 font-mono text-[12.5px] tracking-[0.1em] text-ink-2 uppercase hover:text-ink disabled:opacity-40"
                  disabled={checks.length >= 7}
                  onClick={() => setChecks([...checks, { id: `new-${Date.now()}`, text: "", kind: "judged" }])}
                >
                  {checks.length >= 7 ? "Seven checks at most" : "+ Add a check"}
                </button>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-3">
                  Measured checks are counted by code, not guessed. Judged checks must quote the work to pass.
                </p>
              </>
            )}
          </Step>

          <Step n={3} title={`Hold ${money(price || "0")} with PayPal`} muted={!checks}>
            <p className="text-[16px] leading-relaxed text-ink-2">
              {checks
                ? "Agree the checks and open the job's page. There you approve the hold in PayPal: the money is set aside, not taken."
                : "Once the checks look right, you approve a hold in PayPal. The money is set aside, not taken."}
            </p>
            {checks && (
              <button className="btn mt-5 w-full sm:w-auto" disabled={!ready || !!busy} onClick={hold}>
                {busy === "hold" ? (
                  <>
                    <Spinner /> Opening the job
                  </>
                ) : (
                  <>Agree the checks and hold {money(price || "0")}</>
                )}
              </button>
            )}
            {error && checks && <Note tone="fail">{error}</Note>}
          </Step>
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="lg:rotate-[0.8deg]">
            <Receipt job={draftJob} />
          </div>
          <p className="mt-4 font-mono text-[11px] tracking-[0.1em] text-ink-3 uppercase">The receipt both sides will see</p>
        </aside>
      </div>
    </Page>
  );
}
