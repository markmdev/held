import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useJob, useLedger, useStats } from "../api";
import { Receipt } from "../components/receipt";
import { Page, seconds } from "../components/ui";
import type { Job } from "../../shared/types";

type Phase = "held" | "checking" | "paid";

/** A real paid job, played back from the moment its money was held to the moment it was paid. */
function phaseOf(job: Job, phase: Phase, startedAt: string): Job {
  const last = job.deliveries.at(-1);
  const m = job.money;
  if (phase === "paid" || !last) return job;
  const held = { ...m, state: "held" as const, capturedAmount: undefined, captureId: undefined, payoutBatchId: undefined, payoutStatus: undefined, payoutDoneAt: undefined, paidAt: undefined };
  if (phase === "held") return { ...job, money: held, deliveries: [] };
  return { ...job, money: held, deliveries: [{ ...last, outcome: "checking", at: startedAt }] };
}

const STEPS: [Phase, number][] = [
  ["checking", 1200],
  ["paid", 3400],
];

function Replay({ job }: { job: Job }) {
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>(still ? "paid" : "held");
  const startedAt = useMemo(() => new Date(Date.now() + 1200).toISOString(), [run]);
  useEffect(() => {
    if (still) return;
    setPhase("held");
    const timers = STEPS.map(([p, ms]) => setTimeout(() => setPhase(p), ms));
    return () => timers.forEach(clearTimeout);
  }, [run, still]);
  return (
    <div>
      <div className="lg:rotate-[1.2deg]">
        <Receipt job={phaseOf(job, phase, startedAt)} compact />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4 font-mono text-[11px] tracking-[0.1em] text-ink-3 uppercase">
        <span>A real job on Held, from held to paid</span>
        <button onClick={() => setRun((r) => r + 1)} className="shrink-0 hover:text-ink" disabled={phase !== "paid"}>
          Play again
        </button>
      </div>
    </div>
  );
}

function ReplayOf({ id }: { id: string }) {
  const { data } = useJob(id);
  return data ? <Replay job={data} /> : <div className="receipt h-[640px]" aria-hidden />;
}

function Fact({ value, label, href }: { value: string; label: string; href: string }) {
  return (
    <Link href={href} className="group block">
      <div className="font-serif text-[34px] leading-none font-medium tracking-[-0.02em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{value}</div>
      <div className="mt-2 font-mono text-[11px] tracking-[0.12em] text-ink-2 uppercase">{label}</div>
    </Link>
  );
}

export function Home() {
  const { data: stats } = useStats();
  const { data: rows } = useLedger();
  const proofId = rows?.find((r) => r.state === "paid" && r.verdict === "passed")?.id;
  return (
    <Page>
      <section className="grid items-start gap-12 lg:-mt-4 lg:grid-cols-[minmax(0,1fr)_490px] lg:gap-[72px]">
        <div className="lg:pt-10">
          <div className="font-mono text-[12px] tracking-[0.16em] text-ink-2 uppercase">For freelancers and the clients who hire them</div>
          <h1 className="mt-5 text-[50px] leading-[0.98] tracking-[-0.035em] sm:text-[84px]">
            Paid the minute the work <em className="text-paid">passes.</em>
          </h1>
          <p className="mt-6 max-w-xl text-[19px] leading-[1.55] text-ink-2 sm:text-[21px]">
            PayPal holds the client's money. Claude checks the work against the brief, line by line, with a quote for every line. When every line passes and a second,
            separate check agrees, the freelancer is paid.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
            <Link href="/new?example=1" className="btn h-[52px] px-6">
              Try a sample job →
            </Link>
            <Link href="/new" className="self-center border-b-[1.5px] border-ink pb-0.5 font-mono text-[13px] tracking-[0.08em] uppercase sm:self-auto">
              Write your own brief
            </Link>
          </div>
          <p className="mt-4 max-w-xl text-[15px] text-ink-3">About two minutes. Payments run in PayPal's sandbox, and the test buyer's login is shown when you need it.</p>
          <div className="mt-10 flex flex-wrap gap-x-9 gap-y-5 border-t-[1.5px] border-dashed border-line pt-6">
            <Fact href="/ledger" value={stats ? String(stats.jobsPaid) : "–"} label="Jobs paid" />
            <Fact href="/ledger" value={seconds(stats?.medianSecondsToPaid)} label="Median, delivery to paid" />
            <Fact href="/results" value={stats?.benchTotal ? `${stats.benchRight} of ${stats.benchTotal}` : "–"} label="Test verdicts right, first run" />
          </div>
        </div>
        {proofId && <ReplayOf id={proofId} />}
      </section>
    </Page>
  );
}
