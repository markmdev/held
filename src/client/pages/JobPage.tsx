import { useCallback, useState } from "react";
import { cancel, clientKey, clientLink, deliver, fileToBase64, HeldError, jobLink, release, takeClientLink, useConfig, useJob } from "../api";
import { ActionPanel, DeliveryCard, ShareLink, type Busy, type DeliverInput } from "../components/job";
import { Receipt, Timeline } from "../components/receipt";
import { PayPalHold } from "../components/PayPalHold";
import { cx, Empty, Page, seconds, Spinner } from "../components/ui";
import { EXAMPLE, FINISHED, UNFINISHED } from "../../shared/example";
import type { Delivery, Job } from "../../shared/types";

export function JobPage({ id }: { id: string }) {
  useState(() => takeClientLink(id));
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
  const st = job.money.state;
  const last = shown.at(-1);
  const mine = (st === "awaiting_hold" || st === "held") && !job.money.expired ? clientLink(job.id) : null;

  return (
    <Page>
      <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,640px)_320px] lg:justify-center lg:gap-10">
        <aside className="order-3 lg:sticky lg:top-24 lg:order-1">
          <div className="label mb-3">What happened</div>
          <Timeline job={view} />
          <div className="mt-7">
            <ShareLink url={jobLink(job.id)} label="Copy the job's link" />
            <p className="mt-2 text-[14px] leading-snug text-ink-3">One page for both sides. Send it to the freelancer.</p>
            {mine && (
              <div className="mt-5">
                <ShareLink url={mine} label="Copy your client link" />
                <p className="mt-2 text-[14px] leading-snug text-ink-3">Keep this one to yourself: it opens the job with the release and cancel buttons in another browser.</p>
              </div>
            )}
          </div>
        </aside>

        <div className={cx("min-w-0 lg:order-2", st === "awaiting_hold" ? "order-2" : "order-1")}>
          <Receipt job={view} />
          {deliveries.length > 0 && (
            <section className="mt-10">
              <div className="label mb-3">{deliveries.length === 1 ? "The delivery" : `Deliveries, newest first`}</div>
              <div className="flex flex-col gap-3">
                {deliveries.map(({ d, n }) => (
                  <DeliveryCard key={d.id} job={view} d={d} n={n} latest={n === shown.length} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className={cx("lg:sticky lg:top-24 lg:order-3", st === "awaiting_hold" ? "order-1" : "order-2")}>
          {st === "paid" && last?.secondsToPaid != null && (
            <div className="mb-6">
              <div className="label">Delivery to paid</div>
              <div className="mt-1 font-serif text-[64px] leading-none font-medium tracking-[-0.03em] text-paid">{seconds(last.secondsToPaid)}</div>
              <p className="mt-3 text-[16px] leading-relaxed text-ink-2">Every check passed, so PayPal took the held money and paid {job.freelancerEmail}.</p>
            </div>
          )}
          <ActionPanel
            job={view}
            client={!!clientKey(job.id)}
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
