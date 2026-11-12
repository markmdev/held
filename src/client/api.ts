import { useCallback, useEffect, useState } from "react";
import type { ApiError, BenchResult, Check, Job, LedgerRow, Stats } from "../shared/types";

export type Config = { paypalClientId: string | null; checksPerDay: number; checksLeft: number; sandboxBuyer: { email: string; password: string } | null };

export class HeldError extends Error {
  constructor(message: string, public code?: ApiError["code"]) {
    super(message);
  }
}

async function api<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`/api${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: "The server didn't answer. Try again." }));
  if (!res.ok) throw new HeldError((data as ApiError).error, (data as ApiError).code);
  return data as T;
}

// One loader per page: data, the error if it failed, and a way to load again.
function useLoad<T>(path: string | null, every?: (d: T) => number | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!path) return;
    api<T>(path).then((d) => { setData(d); setError(null); }, (e: Error) => setError(e.message));
  }, [path]);
  useEffect(load, [load]);
  useEffect(() => {
    const ms = data && every ? every(data) : null;
    if (!ms) return;
    const t = setTimeout(load, ms);
    return () => clearTimeout(t);
  }, [data, every, load]);
  return { data, error, reload: load, setData };
}

const payoutDone = (s?: string) => !s || ["SUCCESS", "FAILED", "RETURNED", "UNCLAIMED", "BLOCKED", "REFUNDED"].includes(s);
const jobPoll = (j: Job) => (j.deliveries.some((d) => d.outcome === "checking") || (j.money.payoutBatchId && !payoutDone(j.money.payoutStatus)) ? 2000 : null);

export const useConfig = () => useLoad<Config>("/config").data;
export const useStats = () => useLoad<Stats>("/stats");
export const useLedger = () => useLoad<LedgerRow[]>("/ledger");
export const useResults = () => useLoad<BenchResult>("/results");
export const useJob = (id: string) => useLoad<Job>(`/jobs/${id}`, jobPoll);

export const makeChecks = (brief: string) => api<{ title: string; checks: Check[] }>("/checks", { brief });
// The client's key stays in the browser that made the job. The job's link doesn't carry it, so the freelancer
// can't release or cancel the money.
const keyName = (id: string) => `held.client.${id}`;
export const clientKey = (id: string) => localStorage.getItem(keyName(id));
export const jobLink = (id: string) => `${location.origin}/j/${id}`;

// The client link carries the key after a #, which a browser never sends to a server. Opening it gives that
// browser the client's buttons and leaves the plain link in the address bar.
export function clientLink(id: string) {
  const key = clientKey(id);
  return key && `${jobLink(id)}#client=${key}`;
}
export function takeClientLink(id: string) {
  const key = /^#client=([0-9a-f]{64})$/.exec(location.hash)?.[1];
  if (!key) return;
  localStorage.setItem(keyName(id), key);
  history.replaceState(null, "", location.pathname);
}
const asClient = (id: string) => ({ "x-client-key": clientKey(id) ?? "" });

export async function createJob(j: { title: string; brief: string; amount: string; freelancerEmail: string; checks: Check[] }) {
  const made = await api<{ id: string; clientKey: string }>("/jobs", j);
  localStorage.setItem(keyName(made.id), made.clientKey);
  return made;
}
export const createOrder = (id: string) => api<{ orderId: string }>(`/jobs/${id}/order`, {});
export const authorize = (id: string) => api<Job>(`/jobs/${id}/authorize`, {});
export const deliver = (id: string, d: { text?: string; link?: string; file?: { name: string; type: string; base64: string } }) => api<Job>(`/jobs/${id}/deliveries`, d);
export const release = (id: string, amount?: string) => api<Job>(`/jobs/${id}/release`, amount ? { amount } : {}, asClient(id));
export const cancel = (id: string) => api<Job>(`/jobs/${id}/cancel`, {}, asClient(id));

export function fileToBase64(file: File): Promise<string> {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => bad(r.error);
    r.readAsDataURL(file);
  });
}
