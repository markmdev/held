import { useState, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { createJob, HeldError, makeChecks, useConfig } from "../api";
import { cx, money, Page, Spinner } from "../components/ui";
import { EXAMPLE } from "../../shared/example";
import type { Check } from "../../shared/types";

function Step({ n, title, done, children, muted }: { n: number; title: string; done?: boolean; muted?: boolean; children: ReactNode }) {
  return (
    <section className={cx("card p-5 sm:p-6", muted && "opacity-55")}>
      <div className="flex items-center gap-3">
        <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold", done ? "bg-paid-dot text-white" : "bg-ink text-white")}>
          {done ? "✓" : n}
        </span>
        <h2 className="text-[18px] font-bold">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function NewJob() {
  const example = new URLSearchParams(useSearch()).has("example");
  const [, go] = useLocation();
  const config = useConfig();
  const [brief, setBrief] = useState(example ? EXAMPLE.brief : "");
  const [price, setPrice] = useState(example ? EXAMPLE.amount.replace(/\.00$/, "") : "");
  const [email, setEmail] = useState(example ? "freelancer@held.example" : "");
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

  return (
    <Page>
      <div className="max-w-3xl">
        <h1 className="text-[34px] leading-tight font-[750] sm:text-[42px]">New job</h1>
        <p className="mt-2 text-[17px] leading-relaxed text-ink-2">
          Write the brief in plain words. Held turns it into checks that both of you agree before any money moves.
        </p>
      </div>

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Step n={1} title="The brief" done={!!checks}>
            <label className="label" htmlFor="brief">
              What should be delivered
            </label>
            <textarea id="brief" className="field mt-1.5 min-h-36" value={brief} onChange={(e) => (setBrief(e.target.value), setChecks(null))} />
            <div className="mt-4 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <label className="label" htmlFor="price">
                  Price
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">$</span>
                  <input id="price" className="field pl-6" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="email">
                  Freelancer's PayPal email
                </label>
                <input id="email" className="field mt-1.5" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <button className="btn mt-5 w-full sm:w-auto" disabled={!!busy || !brief.trim() || !!capNow} onClick={draft}>
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
            {capNow && <p className="mt-3 rounded-xl bg-held-bg px-3.5 py-3 text-[14.5px] text-held">{capNow}</p>}
            {error && !checks && <p className="mt-3 text-[14px] text-fail">{error}</p>}
          </Step>

          <Step n={2} title="The checks" muted={!checks}>
            {!checks ? (
              <p className="text-[15px] text-ink-2">The checks appear here. Both sides see exactly what the work will be checked against.</p>
            ) : (
              <>
                <label className="label" htmlFor="title">
                  Job title
                </label>
                <input id="title" className="field mt-1.5 mb-4" value={title} onChange={(e) => setTitle(e.target.value)} />
                <div className="label">Checks</div>
                <ul className="mt-1.5 flex flex-col gap-2">
                  {checks.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-[13px] font-semibold text-ink-3">{i + 1}</span>
                      <input
                        className="field py-2"
                        value={c.text}
                        aria-label={`Check ${i + 1}`}
                        onChange={(e) => setChecks(checks.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
                      />
                      <span className="hidden shrink-0 rounded-md bg-line-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2 sm:inline">
                        {c.kind === "measured" ? "Measured" : "Judged"}
                      </span>
                      <button
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-line-2 hover:text-fail"
                        aria-label="Remove this check"
                        onClick={() => setChecks(checks.filter((x) => x.id !== c.id))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-3 text-[14px] font-semibold text-ink-2 hover:text-ink disabled:opacity-40"
                  disabled={checks.length >= 7}
                  onClick={() => setChecks([...checks, { id: `new-${Date.now()}`, text: "", kind: "judged" }])}
                >
                  {checks.length >= 7 ? "Seven checks at most" : "+ Add a check"}
                </button>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
                  Measured checks are counted by code, not guessed. Judged checks must quote the work to pass.
                </p>
              </>
            )}
          </Step>

          <Step n={3} title={`Hold ${money(price || "0")} with PayPal`} muted={!checks}>
            <p className="text-[15px] leading-relaxed text-ink-2">
              {checks
                ? "Agree the checks and open the job's page. There you approve the hold in PayPal: the money is set aside, not taken."
                : "Once the checks look right, you approve a hold in PayPal. The money is set aside, not taken."}
            </p>
            {checks && (
              <button className="btn mt-4 w-full sm:w-auto" disabled={!ready || !!busy} onClick={hold}>
                {busy === "hold" ? (
                  <>
                    <Spinner /> Opening the job
                  </>
                ) : (
                  <>Agree the checks and hold {money(price || "0")}</>
                )}
              </button>
            )}
            {error && checks && <p className="mt-3 text-[14px] text-fail">{error}</p>}
          </Step>
        </div>

        <aside className="card p-5 lg:sticky lg:top-20">
          <div className="label">What happens next</div>
          <ol className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-ink-2">
            <li>
              <span className="font-semibold text-ink">PayPal holds the money.</span> Nobody can spend it, and it isn't taken yet.
            </li>
            <li>
              <span className="font-semibold text-ink">You share one link</span> with the freelancer. It's the same page for both of you.
            </li>
            <li>
              <span className="font-semibold text-ink">The work is checked</span> against these checks, each with a quote from the work.
            </li>
            <li>
              <span className="font-semibold text-ink">It's paid in seconds</span> once every check passes, or when you release it yourself.
            </li>
          </ol>
        </aside>
      </div>
    </Page>
  );
}
