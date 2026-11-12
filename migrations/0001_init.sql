CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  amount TEXT NOT NULL,
  freelancer_email TEXT NOT NULL,
  checks_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  seeded INTEGER NOT NULL DEFAULT 0,
  money_state TEXT NOT NULL DEFAULT 'awaiting_hold',
  captured_amount TEXT,
  order_id TEXT,
  authorization_id TEXT,
  capture_id TEXT,
  payout_batch_id TEXT,
  payout_status TEXT,
  held_at TEXT,
  paid_at TEXT,
  cancelled_at TEXT
);
CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  at TEXT NOT NULL,
  label TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  outcome TEXT NOT NULL,
  first_json TEXT NOT NULL DEFAULT '[]',
  second_json TEXT,
  missing_json TEXT NOT NULL DEFAULT '[]',
  seconds_to_paid REAL
);
CREATE INDEX deliveries_job ON deliveries(job_id, at);
CREATE TABLE daily_use (day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, kind));
CREATE TABLE paypal_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, resource_id TEXT, at TEXT NOT NULL, verified INTEGER NOT NULL);
