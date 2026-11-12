import { Link } from "wouter";
import { useJob, useLedger, useStats } from "../api";
import type { Job } from "../../shared/types";
import { Mark, money, MoneyPill, Page, seconds } from "../components/ui";

const STEPS = [
  { n: 1, title: "Agree the checks", text: "The client writes the brief in plain words. The AI turns it into a short list of checks both sides see before any money moves." },
  { n: 2, title: "PayPal holds the money", text: "The client approves a hold in PayPal. The money is set aside, not taken, and nobody can spend it." },
  { n: 3, title: "The work is checked", text: "The freelancer delivers. Each check passes or fails with a quote from the work. Counts are measured by code, not guessed." },
  { n: 4, title: "Paid in seconds", text: "When two separate checks agree that every item passes, PayPal takes the held money and pays the freelancer." },
];

/** A real finished job, shown small: what a judge gets to in two minutes. */
function Proof({ job }: { job: Job }) {
  const last = job.deliveries.at(-1);
  return (
    <div className="card relative overflow-hidden p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <MoneyPill state={job.money.state} />
        <span className="font-mono text-[12px] text-ink-3">{job.money.captureId}</span>
      </div>
      <div className="mt-3 text-[15px] font-bold">{job.title}</div>
      <div className="mt-1 text-[34px] leading-none font-[750] tracking-[-0.03em]">{money(job.money.capturedAmount ?? job.money.amount)}</div>
      {last?.secondsToPaid != null && <div className="mt-2 text-[14px] font-semibold text-paid">Paid {seconds(last.secondsToPaid)} after the work was delivered</div>}
      <ul className="mt-4 space-y-2 border-t border-line-2 pt-4">
        {job.checks.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 text-[14px]">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-paid-dot text-[11px] font-black text-white">✓</span>
            <span className="min-w-0 truncate">{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProofOf({ id }: { id: string }) {
  const { data } = useJob(id);
  return data ? <Proof job={data} /> : null;
}

export function Home() {
  const { data: stats } = useStats();
  const { data: rows } = useLedger();
  const proofId = rows?.find((r) => r.state === "paid" && r.verdict === "passed")?.id;
  return (
    <Page>
      <section className="grid items-center gap-10 pt-4 pb-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pt-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[13px] font-semibold text-ink-2 shadow-[0_0_0_1px_var(--color-line)]">
            <Mark size={16} /> For freelancers and the clients who hire them
          </div>
          <h1 className="mt-5 text-[44px] leading-[1.02] font-[780] sm:text-[64px]">Paid the minute the work passes.</h1>
          <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-ink-2">
            PayPal holds the client's money while the freelancer works. An AI check reads the delivery against the brief both sides agreed and quotes the work for every
            item. When it all passes, the freelancer is paid in seconds. No invoice, no chasing.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/new?example=1" className="btn h-12 px-5 text-[16px]">
              Try it with the example job
            </Link>
            <Link href="/new" className="btn btn-quiet h-12 px-5 text-[16px]">
              Write your own brief
            </Link>
          </div>
          <p className="mt-3 text-[13.5px] text-ink-3">About two minutes, nothing to install. PayPal sandbox money, with the login shown when you need it.</p>
        </div>
        {proofId && <ProofOf id={proofId} />}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/ledger" className="block">
          <StatBox value={stats ? String(stats.jobsPaid) : "–"} label="Jobs paid on Held" note="Every one in the ledger, with PayPal's IDs" />
        </Link>
        <Link href="/ledger" className="block">
          <StatBox value={seconds(stats?.medianSecondsToPaid)} label="Median from delivery to paid" note="Measured on the live site" />
        </Link>
        <Link href="/results" className="block">
          <StatBox
            value={stats?.benchTotal ? `${stats.benchRight} of ${stats.benchTotal}` : "–"}
            label="Verdicts right on the test set"
            note="Misses listed on the results page"
          />
        </Link>
      </section>

      <section className="mt-14">
        <h2 className="text-[26px] font-[750] sm:text-[30px]">How it works</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="card p-5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[14px] font-bold text-white">{s.n}</div>
              <div className="mt-3 text-[16.5px] font-bold">{s.title}</div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          The client can always release the money anyway, release part of it, or cancel the hold. If the two checks disagree, nothing moves until the client decides.
        </p>
      </section>
    </Page>
  );
}

function StatBox({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="card h-full px-5 py-4 transition hover:-translate-y-0.5">
      <div className="text-[34px] leading-tight font-[750] tracking-[-0.03em]">{value}</div>
      <div className="mt-1 text-[14.5px] font-semibold">{label}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-3">{note}</div>
    </div>
  );
}
