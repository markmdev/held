import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import type { Delivery, Job } from "../../shared/types";
import { Line } from "./receipt";
import { cx, money, Spinner, when } from "./ui";

/* ---------- a delivery and its verdicts ---------- */

const OUTCOME_WORD: Record<Delivery["outcome"], [string, string]> = {
  checking: ["Checking", "text-held"],
  passed: ["Passed", "text-paid"],
  failed: ["Not yet", "text-fail"],
  disagreed: ["Checks split", "text-ask"],
};

/** One delivery as a slip: what was delivered, and for an earlier one, how each check went. */
export function DeliveryCard({ job, d, n, latest }: { job: Job; d: Delivery; n: number; latest: boolean }) {
  const [open, setOpen] = useState(false);
  const [verdicts, setVerdicts] = useState(false);
  const fails = d.first.filter((v) => !v.pass).length;
  const [word, tone] = OUTCOME_WORD[d.outcome];
  return (
    <article className="border-[1.5px] border-dashed border-line bg-card/60 px-4 py-3.5 sm:px-5">
      <header className="flex items-baseline gap-2 font-mono text-[11.5px] tracking-[0.1em] uppercase">
        <span className="text-ink">Delivery {n}</span>
        <span className="hidden min-w-0 truncate text-ink-3 sm:inline">
          · {d.label} · {when(d.at)}
        </span>
        <span className="leader" />
        <span className={cx("shrink-0 font-semibold whitespace-nowrap", tone)}>{word}</span>
      </header>
      <button onClick={() => setOpen((v) => !v)} className="mt-2 w-full text-left">
        <p className={cx("font-serif text-[15.5px] leading-relaxed text-ink-2", !open && "line-clamp-2")}>{d.excerpt}</p>
        <span className="mt-1 inline-block font-mono text-[11px] tracking-[0.1em] text-ink-3 uppercase hover:text-ink">{open ? "Show less" : "Show what was delivered"}</span>
      </button>
      {!latest && d.outcome !== "checking" && (
        <>
          <button onClick={() => setVerdicts((v) => !v)} className="mt-1 font-mono text-[11px] tracking-[0.1em] text-ink-3 uppercase hover:text-ink">
            {verdicts ? "Hide the checks" : d.outcome === "failed" ? `Missed ${fails} of ${job.checks.length} checks · show each` : "Show each check"}
          </button>
          {verdicts && (
            <ul className="mt-2 font-mono text-[13px] leading-[1.5]">
              {job.checks.map((c, i) => (
                <Line key={c.id} n={i + 1} i={i} check={c} d={d} print />
              ))}
            </ul>
          )}
        </>
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
      <h2 className="mt-1 text-[21px] leading-snug">{title}</h2>
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
  if (actions.cap) return <p className="rounded-[3px] bg-held-bg px-3.5 py-3 text-[14.5px] text-held">{actions.cap}</p>;

  const input: DeliverInput | null =
    tab === "text" ? (text.trim() ? { kind: "text", text } : null) : tab === "file" ? (file ? { kind: "file", file } : null) : url.trim() ? { kind: "link", url } : null;

  return (
    <>
      {actions.deliverExample && (
        <div className="mb-4">
          <div className="label mb-2">Sample deliveries</div>
          <div className="grid gap-2">
            <button className="btn btn-quiet justify-start" disabled={!can} onClick={() => actions.deliverExample!("unfinished")}>
              <span className="h-2 w-2 rounded-full bg-fail" /> A draft that falls short
            </button>
            <button className="btn btn-quiet justify-start" disabled={!can} onClick={() => actions.deliverExample!("finished")}>
              <span className="h-2 w-2 rounded-full bg-paid-dot" /> The finished work
            </button>
          </div>
          <div className="mt-4 label">Or deliver your own</div>
        </div>
      )}
      <div className="mb-2 flex rounded-[3px] bg-line-2 p-1 text-[13.5px] font-semibold">
        {(
          [
            ["text", "Paste text"],
            ["file", "File"],
            ["link", "Link"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("flex-1 rounded-[3px] py-1.5", tab === k ? "bg-card text-ink shadow-sm" : "text-ink-2")}>
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

export function ActionPanel({ job, actions, hold, client }: { job: Job; actions: JobActions; hold: ReactNode; client: boolean }) {
  const [part, setPart] = useState("");
  const st = job.money.state;
  const last = job.deliveries.at(-1);
  const disagreed = last?.outcome === "disagreed";
  const busy = !!actions.busy || last?.outcome === "checking";

  if (job.money.expired)
    return (
      <section className="card p-5 text-[15px] text-ink-2">
        <div className="label">This hold ran out</div>
        <p className="mt-2">PayPal keeps a hold for 29 days. This one reached its end before the work passed, so the money stayed with the client. Start a sample job to see a hold placed and paid.</p>
        <Link href="/new?example=1" className="btn btn-quiet mt-4 w-full">
          Try a sample job
        </Link>
      </section>
    );
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

  if (job.seeded)
    return (
      <section className="card p-5 text-[15px] text-ink-2">
        <div className="label">Kept as it is</div>
        <p className="mt-2">This sample job stays as it is, with its money held after a delivery that fell short. Try one of your own to deliver work and see it paid.</p>
        <Link href="/new?example=1" className="btn btn-quiet mt-4 w-full">
          Try a sample job
        </Link>
      </section>
    );

  const error = actions.error && <p className="rounded-[3px] bg-fail-bg px-3.5 py-3 text-[14px] text-fail">{actions.error}</p>;
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

  if (!client)
    return (
      <div className="flex flex-col gap-4">
        {freelancer}
        <Side who="Client" title={disagreed ? "The checks disagree: the client decides" : "The client's call"}>
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            Only the client can release the money or cancel the hold, from the browser where the job was made.
          </p>
        </Side>
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
          Releasing pays the freelancer now, whatever the checks say. Cancelling gives up the hold, so the money stays with you. Only this browser, where the job was made, has these buttons.
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
      className="inline-flex items-center gap-2 border-[1.5px] border-ink px-3 py-2 font-mono text-[11.5px] tracking-[0.1em] text-ink uppercase transition-colors duration-150 hover:bg-ink hover:text-card"
    >
      {copied ? "Link copied" : "Copy the job's link"}
    </button>
  );
}
