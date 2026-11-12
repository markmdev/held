import { useCallback, useState } from "react";
import { cancel, deliver, fileToBase64, release, useJob } from "../api";
import { PayPalHold } from "../components/PayPalHold";
import { EXAMPLE, FINISHED, UNFINISHED } from "../../shared/example";
import type { Delivery, Job } from "../../shared/types";

const SANDBOX = "https://sandbox.paypal.com";

export function JobPage({ id }: { id: string }) {
  const { data: job, error, setData } = useJob(id);
  const onHeld = useCallback((j: Job) => setData(j), [setData]);
  if (error) return <p className="py-8">{error}</p>;
  if (!job) return <p className="py-8">Loading…</p>;
  const m = job.money;
  return (
    <section className="py-8">
      <h1 className="text-2xl font-bold">{job.title}</h1>
      {job.seeded && <p className="text-sm">A finished job we ran on the live site before submitting.</p>}
      <div className="mt-4 rounded border p-4">
        <p className="text-xl font-bold">
          {m.state === "awaiting_hold" && `$${m.amount} to hold`}
          {m.state === "held" && `Held: $${m.amount}`}
          {m.state === "paid" && `Paid: $${m.capturedAmount ?? m.amount}`}
          {m.state === "part_paid" && `Part paid: $${m.capturedAmount} of $${m.amount}`}
          {m.state === "cancelled" && `Cancelled: $${m.amount} released back to the client`}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 text-sm">
          {m.authorizationId && <><dt>PayPal hold (authorization)</dt><dd><code>{m.authorizationId}</code></dd></>}
          {m.captureId && <><dt>PayPal capture</dt><dd><code>{m.captureId}</code></dd></>}
          {m.payoutBatchId && <><dt>PayPal payout to {job.freelancerEmail}</dt><dd><code>{m.payoutBatchId}</code> · {m.payoutStatus}</dd></>}
        </dl>
        {m.state === "awaiting_hold" && <div className="mt-4"><PayPalHold job={job} onHeld={onHeld} /></div>}
      </div>

      <h2 className="mt-8 font-bold">The agreed checks</h2>
      <ol className="mt-2 list-decimal pl-6">{job.checks.map((c) => <li key={c.id}>{c.text} <span className="text-xs">({c.kind === "measured" ? "measured by code" : "judged by Claude"})</span></li>)}</ol>
      <details className="mt-2 text-sm"><summary>The brief</summary><p className="whitespace-pre-wrap">{job.brief}</p></details>

      <h2 className="mt-8 font-bold">Deliveries</h2>
      {job.deliveries.length === 0 && <p className="text-sm">Nothing delivered yet.</p>}
      {job.deliveries.map((d) => <DeliveryCard key={d.id} job={job} d={d} />)}

      {m.state === "held" && <Actions job={job} onJob={setData} />}
    </section>
  );
}

function DeliveryCard({ job, d }: { job: Job; d: Delivery }) {
  return (
    <div className="mt-4 rounded border p-4">
      <p className="font-bold">
        {d.outcome === "checking" && "Checking…"}
        {d.outcome === "passed" && (d.secondsToPaid !== null ? `Passed every check. Paid in ${d.secondsToPaid} seconds.` : "Passed every check.")}
        {d.outcome === "failed" && "Not yet: the money stays held."}
        {d.outcome === "disagreed" && "The two checks disagree, so nothing moved. The client decides."}
      </p>
      <p className="text-xs">{d.label} · {new Date(d.at).toLocaleString()}</p>
      <ul className="mt-2 text-sm">
        {job.checks.map((c) => {
          const v = d.first.find((x) => x.checkId === c.id);
          const v2 = d.second?.find((x) => x.checkId === c.id);
          if (!v) return null;
          return (
            <li key={c.id} className="mt-2">
              <span>{v.pass ? "✓" : "✗"} {c.text}</span>
              {v2 && v2.pass !== v.pass && <span> (second check: {v2.pass ? "pass" : "fail"})</span>}
              <div className="text-xs">{v.reason}</div>
              {v.quote && <blockquote className="border-l-2 pl-2 text-xs italic">{v.quote}</blockquote>}
            </li>
          );
        })}
      </ul>
      {d.missing.length > 0 && (
        <div className="mt-3 text-sm"><p className="font-bold">Still to fix</p><ul className="list-disc pl-5">{d.missing.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
      )}
    </div>
  );
}

function Actions({ job, onJob }: { job: Job; onJob: (j: Job) => void }) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [part, setPart] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isExample = job.brief === EXAMPLE.brief;

  async function run(label: string, f: () => Promise<Job>) {
    setBusy(label); setError(null);
    try { onJob(await f()); setText(""); setLink(""); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function file(f: File | undefined) {
    if (!f) return;
    const base64 = await fileToBase64(f);
    run("file", () => deliver(job.id, { file: { name: f.name, type: f.type || "application/octet-stream", base64 } }));
  }

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-2">
      <div>
        <h2 className="font-bold">Freelancer: deliver the work</h2>
        {isExample && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded border px-3 py-2" disabled={!!busy} onClick={() => run("unfinished", () => deliver(job.id, { text: UNFINISHED }))}>Deliver the unfinished example</button>
            <button className="rounded border px-3 py-2" disabled={!!busy} onClick={() => run("finished", () => deliver(job.id, { text: FINISHED }))}>Deliver the finished example</button>
          </div>
        )}
        <textarea className="mt-3 block w-full border p-2" rows={6} placeholder="Paste the work" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="mt-2 rounded bg-black px-4 py-2 text-white" disabled={!!busy || !text.trim()} onClick={() => run("text", () => deliver(job.id, { text }))}>Deliver</button>
        <div className="mt-3 text-sm">Or attach a file (PDF, PNG, JPG or text): <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md" disabled={!!busy} onChange={(e) => file(e.target.files?.[0])} /></div>
        <div className="mt-3 flex gap-2 text-sm">
          <input className="flex-1 border p-1" placeholder="Or a link to the work" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="rounded border px-3" disabled={!!busy || !link.trim()} onClick={() => run("link", () => deliver(job.id, { link }))}>Deliver link</button>
        </div>
        {busy && <p className="mt-2 text-sm">{["release", "cancel", "part"].includes(busy) ? "Asking PayPal…" : "Checking the work against each check…"}</p>}
      </div>
      <div>
        <h2 className="font-bold">Client: your money</h2>
        <button className="mt-2 block rounded border px-3 py-2" disabled={!!busy} onClick={() => run("release", () => release(job.id))}>Release ${job.money.amount} anyway</button>
        <div className="mt-2 flex gap-2">
          <input className="w-24 border p-1" placeholder="Amount" value={part} onChange={(e) => setPart(e.target.value)} />
          <button className="rounded border px-3 py-2" disabled={!!busy || !part} onClick={() => run("part", () => release(job.id, part))}>Release part</button>
        </div>
        <button className="mt-2 block rounded border px-3 py-2" disabled={!!busy} onClick={() => run("cancel", () => cancel(job.id))}>Cancel the hold</button>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      <p className="text-xs md:col-span-2">IDs open in PayPal's sandbox at <a className="underline" href={SANDBOX}>sandbox.paypal.com</a>.</p>
    </div>
  );
}
