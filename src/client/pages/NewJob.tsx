import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { createJob, makeChecks } from "../api";
import { EXAMPLE } from "../../shared/example";
import type { Check } from "../../shared/types";

export function NewJob() {
  const example = new URLSearchParams(useSearch()).has("example");
  const [, go] = useLocation();
  const [brief, setBrief] = useState(example ? EXAMPLE.brief : "");
  const [amount, setAmount] = useState(example ? EXAMPLE.amount : "");
  const [email, setEmail] = useState(example ? "freelancer@held.example" : "");
  const [title, setTitle] = useState("");
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setBusy(true); setError(null);
    try { const d = await makeChecks(brief); setChecks(d.checks); setTitle(d.title); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function create() {
    setBusy(true); setError(null);
    try { const { id } = await createJob({ title, brief, amount, freelancerEmail: email, checks: checks ?? [] }); go(`/j/${id}`); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <section className="py-8">
      <h1 className="text-2xl font-bold">New job</h1>
      <label className="mt-6 block">The brief<textarea className="mt-1 block w-full border p-2" rows={6} value={brief} onChange={(e) => setBrief(e.target.value)} /></label>
      <div className="mt-4 flex gap-4">
        <label>Price (USD)<input className="mt-1 block border p-2" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="flex-1">Freelancer's PayPal email<input className="mt-1 block w-full border p-2" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      </div>
      <button className="mt-4 rounded border px-4 py-2" disabled={busy} onClick={draft}>{busy && !checks ? "Turning the brief into checks…" : "Turn the brief into checks"}</button>
      {checks && (
        <div className="mt-6">
          <label className="block">Job title<input className="mt-1 block w-full border p-2" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <h2 className="mt-4 font-bold">The checks both sides agree to</h2>
          <ol className="mt-2 list-decimal pl-6">
            {checks.map((c, i) => (
              <li key={c.id} className="mt-1">
                <input className="w-full border p-1" value={c.text} onChange={(e) => setChecks(checks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <span className="text-xs">{c.kind === "measured" ? "Measured by code" : "Judged by Claude"}</span>
              </li>
            ))}
          </ol>
          <button className="mt-6 rounded bg-black px-5 py-3 text-white" disabled={busy} onClick={create}>Hold ${amount.replace(/\.00$/, "")} with PayPal</button>
        </div>
      )}
      {error && <p className="mt-4 text-red-700">{error}</p>}
    </section>
  );
}
