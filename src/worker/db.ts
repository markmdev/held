import type { Check, Delivery, Job, LedgerRow, MoneyState, Verdict } from "../shared/types";

export type JobRow = {
  id: string; title: string; brief: string; amount: string; freelancer_email: string; checks_json: string; created_at: string; seeded: number;
  money_state: MoneyState; captured_amount: string | null; order_id: string | null; authorization_id: string | null; capture_id: string | null;
  payout_batch_id: string | null; payout_status: string | null; held_at: string | null; paid_at: string | null; cancelled_at: string | null;
};
type DeliveryRow = {
  id: string; job_id: string; at: string; label: string; excerpt: string; outcome: Delivery["outcome"];
  first_json: string; second_json: string | null; missing_json: string; seconds_to_paid: number | null;
};

const opt = <T>(v: T | null) => (v === null ? undefined : v);

export function toJob(r: JobRow, ds: DeliveryRow[]): Job {
  return {
    id: r.id, title: r.title, brief: r.brief, freelancerEmail: r.freelancer_email, createdAt: r.created_at, seeded: !!r.seeded,
    checks: JSON.parse(r.checks_json) as Check[],
    money: {
      state: r.money_state, amount: r.amount, capturedAmount: opt(r.captured_amount), orderId: opt(r.order_id), authorizationId: opt(r.authorization_id),
      captureId: opt(r.capture_id), payoutBatchId: opt(r.payout_batch_id), payoutStatus: opt(r.payout_status),
      heldAt: opt(r.held_at), paidAt: opt(r.paid_at), cancelledAt: opt(r.cancelled_at),
    },
    deliveries: ds.map((d) => ({
      id: d.id, at: d.at, label: d.label, excerpt: d.excerpt, outcome: d.outcome,
      first: JSON.parse(d.first_json) as Verdict[], second: d.second_json ? (JSON.parse(d.second_json) as Verdict[]) : null,
      missing: JSON.parse(d.missing_json) as string[], secondsToPaid: d.seconds_to_paid,
    })),
  };
}

export async function getJobRow(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").bind(id).first<JobRow>();
}

export async function getJob(db: D1Database, id: string): Promise<Job | null> {
  const row = await getJobRow(db, id);
  if (!row) return null;
  const { results } = await db.prepare("SELECT * FROM deliveries WHERE job_id = ? ORDER BY at").bind(id).all<DeliveryRow>();
  return toJob(row, results);
}

export async function updateJob(db: D1Database, id: string, fields: Partial<JobRow>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await db.prepare(`UPDATE jobs SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => (fields as Record<string, unknown>)[k] ?? null), id).run();
}

export async function ledger(db: D1Database): Promise<LedgerRow[]> {
  const { results } = await db.prepare(`
    SELECT j.*, (SELECT outcome FROM deliveries d WHERE d.job_id = j.id ORDER BY d.at DESC LIMIT 1) AS last_outcome,
      (SELECT MIN(seconds_to_paid) FROM deliveries d WHERE d.job_id = j.id) AS secs
    FROM jobs j WHERE j.money_state != 'awaiting_hold' OR j.seeded = 1 ORDER BY j.created_at DESC LIMIT 500`).all<JobRow & { last_outcome: Delivery["outcome"] | null; secs: number | null }>();
  return results.map((r) => ({
    id: r.id, title: r.title, createdAt: r.created_at, seeded: !!r.seeded, state: r.money_state, amount: r.captured_amount ?? r.amount,
    verdict: r.last_outcome ?? "none", secondsToPaid: r.secs, authorizationId: opt(r.authorization_id), captureId: opt(r.capture_id), payoutBatchId: opt(r.payout_batch_id),
  }));
}

// Counts one use of a daily allowance, or says it's spent. The day is UTC.
export async function takeDaily(db: D1Database, kind: string, perDay: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const r = await db
    .prepare("INSERT INTO daily_use (day, kind, n) VALUES (?, ?, 1) ON CONFLICT (day, kind) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n")
    .bind(day, kind, perDay)
    .first<{ n: number }>();
  return !!r;
}

export async function dailyLeft(db: D1Database, kind: string, perDay: number) {
  const day = new Date().toISOString().slice(0, 10);
  const r = await db.prepare("SELECT n FROM daily_use WHERE day = ? AND kind = ?").bind(day, kind).first<{ n: number }>();
  return Math.max(0, perDay - (r?.n ?? 0));
}
