import { useCallback, useState } from "react";
import { cancel, deliver, fileToBase64, HeldError, release, useConfig, useJob } from "../api";
import { ActionPanel, CheckList, DeliveryCard, MoneyCard, ShareLink, type Busy, type DeliverInput } from "../components/job";
import { PayPalHold } from "../components/PayPalHold";
import { cx, Empty, Page, Spinner, when } from "../components/ui";
import { EXAMPLE, FINISHED, UNFINISHED } from "../../shared/example";
import type { Delivery, Job } from "../../shared/types";

export function JobPage({ id }: { id: string }) {
  const { data: job, error, reload, setData } = useJob(id);
  const config = useConfig();
  const [busy, setBusy] = useState<Busy>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const [pending, setPending] = useState<Delivery | null>(null);
  const onHeld = useCallback((j: Job) => setData(j), [setData]);

  if (error && !job)
    return (
      <Page>
        <div className="mx-auto max-w-lg pt-10">
          <Empty title="This job couldn't be opened">
            {error}
            <div className="mt-4">
              <button className="btn btn-quiet" onClick={reload}>
                Try again
              </button>
            </div>
          </Empty>
        </div>
      </Page>
    );

  if (!job)
    return (
      <Page>
        <div className="flex items-center gap-3 pt-10 text-[15px] text-ink-2">
          <Spinner /> Opening the job
        </div>
      </Page>
    );

  async function run(kind: Exclude<Busy, null>, f: () => Promise<Job>) {
    setBusy(kind);
    setActionError(null);
    try {
      setData(await f());
    } catch (e) {
      if (e instanceof HeldError && e.code === "daily_limit") setCap(e.message);
      else setActionError((e as Error).message);
      reload();
    } finally {
      setBusy(null);
      setPending(null);
    }
  }

  async function send(input: DeliverInput) {
    const label = input.kind === "text" ? "Pasted text" : input.kind === "file" ? input.file.name : input.url;
    const excerpt = input.kind === "text" ? input.text.replace(/\s+/g, " ").slice(0, 300) : `${label} (attached)`;
    setPending({ id: "pending", at: new Date().toISOString(), label, excerpt, outcome: "checking", first: [], second: null, missing: [], secondsToPaid: null });
    const body =
      input.kind === "text"
        ? { text: input.text }
        : input.kind === "link"
          ? { link: input.url }
          : { file: { name: input.file.name, type: input.file.type || "application/octet-stream", base64: await fileToBase64(input.file) } };
    await run("deliver", () => deliver(job!.id, body));
  }

  const capNow = cap ?? (config && config.checksLeft <= 0 ? "Today's live checks are used up. Come back tomorrow, or read the finished jobs in the ledger." : null);
  const shown = pending && !job.deliveries.some((d) => d.outcome === "checking") ? [...job.deliveries, pending] : job.deliveries;
  const view = { ...job, deliveries: shown };
  const deliveries = shown.map((d, i) => ({ d, n: i + 1 })).reverse();

  return (
    <Page>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Job</div>
          <div className="mt-0.5 truncate text-[17px] font-bold sm:text-[19px]">{job.title}</div>
        </div>
        <ShareLink id={job.id} />
      </div>

      <MoneyCard job={view} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <div className={job.money.state === "awaiting_hold" ? "order-2" : "order-1"}>
            <CheckList job={view} />
          </div>
          {deliveries.length > 0 && (
            <section className="order-3 flex min-w-0 flex-col gap-4">
              <h2 className="text-[19px] font-bold">Deliveries</h2>
              {deliveries.map(({ d, n }) => (
                <DeliveryCard key={d.id} job={view} d={d} n={n} latest={n === shown.length} />
              ))}
            </section>
          )}
          <section className="card order-4 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[19px] font-bold">The brief</h2>
              <span className="text-[13px] text-ink-3">written {when(job.createdAt)}</span>
            </div>
            <p className="mt-2 text-[15.5px] leading-relaxed whitespace-pre-wrap text-ink-2">{job.brief}</p>
            <div className="mt-3 text-[13.5px] text-ink-3">
              Pays <span className="font-semibold text-ink-2">{job.freelancerEmail}</span> through PayPal.
            </div>
          </section>
        </div>
        <aside className={cx("lg:sticky lg:top-20", job.money.state === "awaiting_hold" ? "order-1" : "order-2")}>
          <ActionPanel
            job={view}
            hold={<PayPalHold job={job} onHeld={onHeld} />}
            actions={{
              deliver: (input) => void send(input),
              deliverExample:
                job.brief === EXAMPLE.brief ? (which) => void send({ kind: "text", text: which === "finished" ? FINISHED : UNFINISHED }) : undefined,
              releaseAll: () => void run("release", () => release(job.id)),
              releasePart: (amount) => void run("release", () => release(job.id, amount)),
              cancel: () => void run("cancel", () => cancel(job.id)),
              busy,
              error: actionError,
              cap: capNow,
            }}
          />
        </aside>
      </div>
    </Page>
  );
}
