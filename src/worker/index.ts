import { Hono } from "hono";
import type { Context } from "hono";
import bench from "../../bench/results.json";
import type { ApiError, BenchResult, Check, Stats } from "../shared/types";
import { briefToChecks, checkDelivery, FIRST_MODEL, SECOND_MODEL, validMeasure } from "./claude";
import { dailyLeft, getJob, getJobRow, ledger, takeDaily, updateJob } from "./db";
import { measure, type Measured } from "./measure";
import * as paypal from "./paypal";
import { settle } from "./verdict";
import { pdfText } from "./pdf";
import type { AgLlmRequest } from "ag-studio";
import { agentTurn } from "./agent";

type Env = {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  PAYPAL_API: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_WEBHOOK_ID?: string;
  DAILY_CHECKS: string;
  DAILY_AGENT_TURNS: string;
  SANDBOX_BUYER_EMAIL?: string;
  SANDBOX_BUYER_PASSWORD?: string;
};
type C = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>().basePath("/api");

const fail = (c: C, status: 400 | 404 | 409 | 413 | 429 | 502, error: string, code?: ApiError["code"]) => c.json<ApiError>({ error, code }, status);
const now = () => new Date().toISOString();
const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const perDay = (c: C) => Number(c.env.DAILY_CHECKS) || 200;
const money = (v: unknown) => (typeof v === "string" || typeof v === "number") && /^\d{1,5}(\.\d{1,2})?$/.test(String(v)) && Number(v) >= 1 ? Number(v).toFixed(2) : null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.onError((err, c) => {
  console.error(err);
  if (err instanceof paypal.PayPalError) return c.json<ApiError>({ error: err.message, code: "paypal" }, 502);
  if (err.message.startsWith("Claude")) return c.json<ApiError>({ error: "The checker couldn't answer just now. Try again in a minute.", code: "claude" }, 502);
  return c.json<ApiError>({ error: "Something went wrong. Try again." }, 500);
});

app.get("/health", (c) => c.json({ ok: true }));

app.get("/config", async (c) =>
  c.json({
    paypalClientId: c.env.PAYPAL_CLIENT_ID ?? null,
    checksPerDay: perDay(c),
    checksLeft: await dailyLeft(c.env.DB, "check", perDay(c)),
    sandboxBuyer: c.env.SANDBOX_BUYER_EMAIL ? { email: c.env.SANDBOX_BUYER_EMAIL, password: c.env.SANDBOX_BUYER_PASSWORD ?? "" } : null,
  }),
);

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return Math.round(m * 10) / 10;
}

app.get("/stats", async (c) => {
  const paid = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM jobs WHERE money_state IN ('paid', 'part_paid')").first<{ n: number }>();
  const { results } = await c.env.DB.prepare("SELECT seconds_to_paid AS s FROM deliveries WHERE seconds_to_paid IS NOT NULL ORDER BY s").all<{ s: number }>();
  const s = results.map((r) => r.s);
  const { results: payouts } = await c.env.DB.prepare(
    "SELECT (julianday(j.payout_done_at) - julianday(d.at)) * 86400 AS s FROM jobs j JOIN deliveries d ON d.job_id = j.id WHERE d.seconds_to_paid IS NOT NULL AND j.payout_done_at IS NOT NULL",
  ).all<{ s: number }>();
  const b = bench as BenchResult;
  return c.json<Stats>({ jobsPaid: paid?.n ?? 0, medianSecondsToPaid: median(s), medianSecondsToPayout: median(payouts.map((r) => r.s)), benchRight: b.tuning.right + b.heldOut.right, benchTotal: b.tuning.total + b.heldOut.total });
});

app.get("/ledger", async (c) => c.json(await ledger(c.env.DB)));
app.get("/results", (c) => c.json(bench as BenchResult));

// The brief, turned into checks both sides see before any money is held.
app.post("/checks", async (c) => {
  const { brief } = (await c.req.json().catch(() => ({}))) as { brief?: string };
  if (!brief || brief.trim().length < 20) return fail(c, 400, "Write the brief first: what you want delivered, in a sentence or two.", "bad_request");
  if (!(await takeDaily(c.env.DB, "brief", perDay(c)))) return fail(c, 429, "Today's live checks are used up. Come back tomorrow, or read the finished jobs in the ledger.", "daily_limit");
  return c.json(await briefToChecks(c.env.ANTHROPIC_API_KEY, brief.slice(0, 4000)));
});

app.post("/jobs", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { title?: string; brief?: string; amount?: unknown; freelancerEmail?: string; checks?: Partial<Check>[] };
  const amount = money(b.amount);
  if (!b.brief?.trim() || !b.title?.trim()) return fail(c, 400, "A job needs a brief and a title.", "bad_request");
  if (!amount || Number(amount) > 10000) return fail(c, 400, "The price must be between $1 and $10,000.", "bad_request");
  if (!b.freelancerEmail || !EMAIL.test(b.freelancerEmail)) return fail(c, 400, "Give the freelancer's PayPal email.", "bad_request");
  const checks: Check[] = (b.checks ?? [])
    .filter((x) => typeof x.text === "string" && x.text.trim())
    .slice(0, 7)
    .map((x, i) => {
      const m = x.kind === "measured" ? validMeasure(x.measure) : undefined;
      return { id: `c${i + 1}`, text: x.text!.trim().slice(0, 200), kind: m ? "measured" : "judged", ...(m ? { measure: m } : {}) };
    });
  if (checks.length < 1) return fail(c, 400, "Add at least one check.", "bad_request");
  const id = newId("job");
  await c.env.DB.prepare("INSERT INTO jobs (id, title, brief, amount, freelancer_email, checks_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, b.title.trim().slice(0, 80), b.brief.trim().slice(0, 4000), amount, b.freelancerEmail.trim(), JSON.stringify(checks), now())
    .run();
  return c.json({ id });
});

app.get("/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const row = await getJobRow(c.env.DB, id);
  if (!row) return fail(c, 404, "No job at this link.", "not_found");
  if (row.payout_batch_id && (row.payout_status !== "SUCCESS" || !row.payout_done_at) && !["FAILED", "RETURNED", "UNCLAIMED", "BLOCKED", "REFUNDED"].includes(row.payout_status ?? "")) {
    const p = await paypal.payoutStatus(c.env, row.payout_batch_id).catch(() => null);
    if (p && (p.status !== row.payout_status || (p.status === "SUCCESS" && p.doneAt)))
      await updateJob(c.env.DB, id, { payout_status: p.status, ...(p.status === "SUCCESS" && p.doneAt ? { payout_done_at: p.doneAt } : {}) });
  }
  return c.json(await getJob(c.env.DB, id));
});

// The client's PayPal window asks for an order, then the hold is placed on it.
app.post("/jobs/:id/order", async (c) => {
  const row = await getJobRow(c.env.DB, c.req.param("id"));
  if (!row) return fail(c, 404, "No job at this link.", "not_found");
  if (row.money_state !== "awaiting_hold") return fail(c, 409, "This job's money is already held.");
  const orderId = await paypal.createOrder(c.env, row.id, row.title, row.amount);
  await updateJob(c.env.DB, row.id, { order_id: orderId });
  return c.json({ orderId });
});

app.post("/jobs/:id/authorize", async (c) => {
  const row = await getJobRow(c.env.DB, c.req.param("id"));
  if (!row) return fail(c, 404, "No job at this link.", "not_found");
  if (row.money_state !== "awaiting_hold" || !row.order_id) return fail(c, 409, "There's no PayPal approval waiting for this job.");
  const hold = await paypal.authorizeOrder(c.env, row.order_id);
  await updateJob(c.env.DB, row.id, { authorization_id: hold.id, hold_expires_at: hold.expiresAt, money_state: "held", held_at: now() });
  return c.json(await getJob(c.env.DB, row.id));
});

type Incoming = { text?: string; link?: string; file?: { name: string; type: string; base64: string } };

async function readDelivery(d: Incoming): Promise<{ label: string; text: string | null; blocks: Record<string, unknown>[] }> {
  if (d.text?.trim()) return { label: "Pasted text", text: d.text.slice(0, 60000), blocks: [{ type: "text", text: d.text.slice(0, 60000) }] };
  if (d.file?.base64) {
    const { name, type, base64 } = d.file;
    if (base64.length > 7_000_000) throw new Error("bad: The file is over 5 MB.");
    if (type === "application/pdf") return { label: name, text: await pdfText(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))), blocks: [{ type: "document", source: { type: "base64", media_type: type, data: base64 } }] };
    if (/^image\/(png|jpeg|gif|webp)$/.test(type)) return { label: name, text: null, blocks: [{ type: "image", source: { type: "base64", media_type: type, data: base64 } }] };
    if (type.startsWith("text/") || /\.(txt|md|csv|html?)$/i.test(name)) {
      const text = new TextDecoder().decode(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))).slice(0, 60000);
      return { label: name, text, blocks: [{ type: "text", text }] };
    }
    throw new Error("bad: Deliver text, a PDF, or a PNG or JPG image.");
  }
  if (d.link && /^https?:\/\//.test(d.link)) {
    const res = await fetch(d.link, { headers: { "user-agent": "HeldChecker/1.0" }, redirect: "follow" }).catch(() => null);
    if (!res?.ok) throw new Error("bad: The link didn't load.");
    const html = (await res.text()).slice(0, 400000);
    const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim().slice(0, 60000);
    return { label: d.link.slice(0, 200), text, blocks: [{ type: "text", text }] };
  }
  throw new Error("bad: Paste the work, attach a file, or give a link.");
}

app.post("/jobs/:id/deliveries", async (c) => {
  const row = await getJobRow(c.env.DB, c.req.param("id"));
  if (!row) return fail(c, 404, "No job at this link.", "not_found");
  if (row.money_state !== "held") return fail(c, 409, row.money_state === "awaiting_hold" ? "The client hasn't held the money yet." : "This job is closed.");
  let delivery;
  try {
    delivery = await readDelivery((await c.req.json().catch(() => ({}))) as Incoming);
  } catch (e) {
    const m = (e as Error).message;
    if (m.startsWith("bad: ")) return fail(c, 400, m.slice(5), "bad_request");
    throw e;
  }
  if (!(await takeDaily(c.env.DB, "check", perDay(c)))) return fail(c, 429, "Today's live checks are used up. Come back tomorrow, or read the finished jobs in the ledger.", "daily_limit");

  const checks = JSON.parse(row.checks_json) as Check[];
  const id = newId("dlv");
  const at = now();
  const excerpt = (delivery.text ?? `${delivery.label} (attached)`).replace(/\s+/g, " ").slice(0, 300);
  await c.env.DB.prepare("INSERT INTO deliveries (id, job_id, at, label, excerpt, outcome) VALUES (?, ?, ?, ?, ?, 'checking')").bind(id, row.id, at, delivery.label, excerpt).run();

  const measured: Record<string, Measured> = {};
  if (delivery.text !== null) for (const ch of checks) if (ch.measure) measured[ch.id] = measure(ch.measure, delivery.text);
  const facts = Object.fromEntries(Object.entries(measured).map(([k, m]) => [k, m.fact]));

  try {
    const first = settle(checks, measured, await checkDelivery(c.env.ANTHROPIC_API_KEY, FIRST_MODEL, row.brief, checks, facts, delivery.blocks), delivery.text);
    let second = null as ReturnType<typeof settle> | null;
    if (first.allPass) second = settle(checks, measured, await checkDelivery(c.env.ANTHROPIC_API_KEY, SECOND_MODEL, row.brief, checks, facts, delivery.blocks), delivery.text);
    const outcome = !first.allPass ? "failed" : second!.allPass ? "passed" : "disagreed";
    const missing = outcome === "disagreed" ? second!.missing : first.missing;
    await c.env.DB.prepare("UPDATE deliveries SET outcome = ?, first_json = ?, second_json = ?, missing_json = ? WHERE id = ?")
      .bind(outcome, JSON.stringify(first.verdicts), second ? JSON.stringify(second.verdicts) : null, JSON.stringify(missing), id)
      .run();
    if (outcome === "passed") {
      const fresh = (await getJobRow(c.env.DB, row.id))!;
      if (fresh.money_state === "held") {
        await release(c.env, fresh, null, id);
        const secs = Math.round((Date.now() - Date.parse(at)) / 100) / 10;
        await c.env.DB.prepare("UPDATE deliveries SET seconds_to_paid = ? WHERE id = ?").bind(secs, id).run();
      }
    }
  } catch (e) {
    await c.env.DB.prepare("DELETE FROM deliveries WHERE id = ? AND outcome = 'checking'").bind(id).run();
    throw e;
  }
  return c.json(await getJob(c.env.DB, row.id));
});

// Takes the held money (all of it, or part) and pays the freelancer what was taken.
async function release(env: Env, row: Awaited<ReturnType<typeof getJobRow>> & {}, amount: string | null, requestId: string) {
  const cap = await paypal.capture(env, row.authorization_id!, amount, `cap-${requestId}`);
  const taken = cap.amount ?? amount ?? row.amount;
  await updateJob(env.DB, row.id, { capture_id: cap.id, captured_amount: taken, money_state: amount && Number(amount) < Number(row.amount) ? "part_paid" : "paid", paid_at: now() });
  const p = await paypal.payout(env, row.id, row.freelancer_email, taken, `pay-${requestId}`);
  await updateJob(env.DB, row.id, { payout_batch_id: p.batchId, payout_status: p.status });
}

app.post("/jobs/:id/release", async (c) => {
  const row = await getJobRow(c.env.DB, c.req.param("id"));
  if (!row) return fail(c, 404, "No job at this link.", "not_found");
  if (row.money_state !== "held") return fail(c, 409, "There's no held money to release.");
  const { amount: raw } = (await c.req.json().catch(() => ({}))) as { amount?: unknown };
  const amount = raw === undefined || raw === null || raw === "" ? null : money(raw);
  if (raw && (!amount || Number(amount) > Number(row.amount))) return fail(c, 400, `Release between $1 and $${row.amount}.`, "bad_request");
  await release(c.env, row, amount, newId("rel"));
  return c.json(await getJob(c.env.DB, row.id));
});

app.post("/jobs/:id/cancel", async (c) => {
  const row = await getJobRow(c.env.DB, c.req.param("id"));
  if (!row) return fail(c, 404, "No job at this link.", "not_found");
  if (row.money_state !== "held") return fail(c, 409, "There's no held money to cancel.");
  await paypal.voidHold(c.env, row.authorization_id!);
  await updateJob(c.env.DB, row.id, { money_state: "cancelled", cancelled_at: now() });
  return c.json(await getJob(c.env.DB, row.id));
});

// PayPal's own word on what happened, checked with PayPal before it's believed.
// One turn of the ledger's agent. Its turns have their own daily allowance, so questions can't use up the checks.
app.post("/agent", async (c) => {
  // Anyone can post here, so a turn far bigger than Studio's own (about 60 kB) is refused before it reaches Claude.
  const body = await c.req.text();
  if (body.length > 200_000) return fail(c, 413, "That question is too long for the ledger's agent.", "bad_request");
  let req: AgLlmRequest | null = null;
  try {
    req = JSON.parse(body) as AgLlmRequest;
  } catch {}
  if (!Array.isArray(req?.input)) return fail(c, 400, "Send AG Studio's turn.", "bad_request");
  if (!(await takeDaily(c.env.DB, "agent", Number(c.env.DAILY_AGENT_TURNS) || 600)))
    return fail(c, 429, "Today's questions about the ledger are used up. Come back tomorrow.", "daily_limit");
  return c.json(await agentTurn(c.env.ANTHROPIC_API_KEY, req));
});

app.post("/paypal/webhook", async (c) => {
  const event = (await c.req.json().catch(() => null)) as { id?: string; event_type?: string; resource?: { id?: string; payout_batch_id?: string; transaction_status?: string; time_processed?: string } } | null;
  if (!event?.id || !event.event_type) return c.body(null, 400);
  const verified = await paypal.verifyWebhook(c.env, c.req.raw.headers, event).catch(() => false);
  await c.env.DB.prepare("INSERT OR IGNORE INTO paypal_events (id, type, resource_id, at, verified) VALUES (?, ?, ?, ?, ?)").bind(event.id, event.event_type, event.resource?.id ?? null, now(), verified ? 1 : 0).run();
  if (!verified) return c.body(null, 400);
  const r = event.resource ?? {};
  if (event.event_type === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED" && r.payout_batch_id)
    await c.env.DB.prepare("UPDATE jobs SET payout_status = 'SUCCESS', payout_done_at = COALESCE(payout_done_at, ?) WHERE payout_batch_id = ?").bind(r.time_processed ?? null, r.payout_batch_id).run();
  if (event.event_type === "PAYMENT.AUTHORIZATION.VOIDED" && r.id)
    await c.env.DB.prepare("UPDATE jobs SET money_state = 'cancelled', cancelled_at = COALESCE(cancelled_at, ?) WHERE authorization_id = ? AND money_state = 'held'").bind(now(), r.id).run();
  return c.body(null, 200);
});

export default app;
