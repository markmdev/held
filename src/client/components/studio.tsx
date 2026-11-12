import { studioTheme, type AgDataSourcesDefinition, type AgResponsiveLayoutBreakpoint, type AgReportState, type AgWidgetLayoutState, type AgWidgetParams } from "ag-studio";
import { createWidgets } from "ag-studio-react";
import type { CustomCellRendererProps } from "ag-grid-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useJob } from "../api";
import type { Job, LedgerRow } from "../../shared/types";
import { cx, money, MoneyPill, OutcomePill, seconds, Spinner, when } from "./ui";

/* ---------- theme: Held's tokens, so the dashboard reads as part of the page ---------- */

const ROW = 18;
const v = (name: string) => `var(--color-${name})`;
const line = (name: string) => ({ width: 1, color: v(name) });
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SERIF = "Newsreader, Georgia, 'Times New Roman', serif";

// Charts take the palette in the order of their measures, so every chart lists its measures in this order:
// paid green, held amber, grey, failed red, disagree violet.
const PALETTE = ["#2a9d5c", "#d08a12", "#b9b4aa", "#b42318", "#5a3fd1"];

export const heldTheme = studioTheme.withParams({
  fontFamily: MONO,
  fontSize: 13,
  textColor: v("ink"),
  foregroundColor: v("ink"),
  subtleTextColor: v("ink-3"),
  backgroundColor: v("card"),
  borderColor: v("line"),
  accentColor: v("ink-3"),
  rowHoverColor: v("paper"),

  studioMinWidth: 0,
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: v("paper"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: v("paper"),
  studioCanvasPadding: 0,
  studioCanvasRowHeight: ROW,
  studioCanvasFontFamily: MONO,

  studioWidgetBackgroundColor: v("card"),
  studioWidgetBorder: line("line"),
  studioWidgetBorderRadius: 4,
  studioWidgetPadding: 14,
  studioWidgetTitleFontFamily: SERIF,
  studioWidgetTitleFontSize: 18,
  studioWidgetTitleFontWeight: 500,
  studioWidgetTitleTextColor: v("ink"),
  studioWidgetSubtitleFontFamily: MONO,
  studioWidgetSubtitleFontSize: 12,
  studioWidgetSubtitleTextColor: v("ink-3"),
  studioWidgetCaptionFontFamily: MONO,
  studioWidgetCaptionFontSize: 12,
  studioWidgetCaptionTextColor: v("ink-3"),

  gridFontFamily: MONO,
  gridFontSize: 13,
  gridCellTextColor: v("ink"),
  gridHeaderBackgroundColor: v("card"),
  gridHeaderTextColor: v("ink-3"),
  gridHeaderFontWeight: 500,
  gridHeaderFontSize: 10.5,
  gridRowHeight: 44,
  gridRowBorder: { ...line("line"), style: "dashed" },
  gridHeaderRowBorder: line("line"),
  gridRowHoverColor: v("paper"),
  gridWrapperBorder: false,
  gridCellHorizontalPadding: 14,

  chartFontFamily: MONO,
  chartTextColor: v("ink-2"),
  chartSubtleTextColor: v("ink-3"),
  chartAxisLineColor: v("line"),
  chartGridLineColor: v("line-2"),
  ...Object.fromEntries(PALETTE.flatMap((c, i) => [[`chartPaletteFills${i + 1}Color`, c], [`chartPaletteStrokes${i + 1}Color`, c]])),
});

/* ---------- data: one row per job, in words people use ---------- */

const MONEY_WORDS: Record<LedgerRow["state"], string> = { awaiting_hold: "Not held yet", held: "Held", paid: "Paid", part_paid: "Part paid", cancelled: "Cancelled" };
const VERDICT_WORDS: Record<LedgerRow["verdict"], string> = { checking: "Checking", passed: "Passed", failed: "Not yet", disagreed: "Checks disagree", none: "No delivery" };

const VERDICT_MEASURES: [LedgerRow["verdict"], string][] = [
  ["passed", "vPassed"],
  ["checking", "vChecking"],
  ["none", "vNone"],
  ["failed", "vFailed"],
  ["disagreed", "vDisagreed"],
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const secs = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const inSeconds = (n: number) => `${secs.format(n)} s`;
const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ledgerData(rows: LedgerRow[]): AgDataSourcesDefinition {
  // Charts group by their category, so each job's label must be its own: jobs started in the same minute get a number.
  const seen = new Map<string, number>();
  const labels = [...rows].reverse().map((r) => {
    const base = stamp.format(new Date(r.createdAt));
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  }).reverse();
  const jobs = rows.map((r, i) => {
    const amount = Number(r.amount);
    const price = Number(r.price);
    const started = new Date(r.createdAt);
    return {
      id: r.id,
      job: r.title,
      label: labels[i],
      day: started.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      started,
      money: MONEY_WORDS[r.state],
      amount,
      paidOut: r.state === "paid" || r.state === "part_paid" ? amount : 0,
      heldNow: r.state === "held" ? price : 0,
      returned: r.state === "cancelled" ? price : r.state === "part_paid" ? price - amount : 0,
      verdict: VERDICT_WORDS[r.verdict],
      ...Object.fromEntries(VERDICT_MEASURES.map(([v, k]) => [k, r.verdict === v ? 1 : 0])),
      secondsToPaid: r.secondsToPaid,
      hold: r.authorizationId ?? "",
      capture: r.captureId ?? "",
      payout: r.payoutBatchId ?? "",
    };
  });
  const paid = jobs.filter((j) => j.secondsToPaid != null).map((j) => ({ jobId: j.id, label: j.label, seconds: j.secondsToPaid as number }));
  const sorted = paid.map((p) => p.seconds).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
  const money = { format: "currencyFormat", formatOptions: { format: usd } } as const;
  const count = (name: string) => ({ format: "integerFormat", name, hide: true }) as const;
  const measure = (id: string, name: string, of: string, fmt: object) => ({ id, name, isMeasure: true, ...fmt, expression: { id: of, aggregation: "sum" } });
  return {
    description: "Held's ledger: every job, what PayPal holds or has paid for it, and the checker's latest verdict.",
    sources: [
      {
        id: "jobs",
        description: "One row per job on Held.",
        data: jobs,
        fields: [
          { id: "id", name: "Job ID", format: "textFormat", hide: true },
          { id: "job", name: "Job", format: "textFormat" },
          { id: "label", name: "Started at", format: "textFormat" },
          { id: "day", name: "Day", format: "textFormat" },
          { id: "started", name: "Started", format: "dateTimeFormat", formatOptions: { format: stamp } },
          { id: "money", name: "Money", format: "textFormat", context: { cell: "money" } },
          { id: "amount", name: "Amount", ...money },
          { id: "paidOut", name: "Paid", ...money },
          { id: "heldNow", name: "Held", ...money },
          { id: "returned", name: "Back to the client", ...money },
          { id: "verdict", name: "Latest verdict", format: "textFormat", context: { cell: "verdict" } },
          ...VERDICT_MEASURES.map(([v, k]) => ({ id: k, ...count(VERDICT_WORDS[v]) })),
          { id: "secondsToPaid", name: "Paid in", format: "decimalFormat", createValueFormatter: () => inSeconds, blankValue: "–" },
          { id: "hold", name: "PayPal hold", format: "textFormat", context: { cell: "id" } },
          { id: "capture", name: "PayPal capture", format: "textFormat", context: { cell: "id" } },
          { id: "payout", name: "PayPal payout", format: "textFormat", context: { cell: "id" } },
        ],
      },
      {
        id: "paid",
        description: "One row per job that was paid after its delivery passed.",
        data: paid,
        fields: [
          { id: "jobId", name: "Job ID", format: "textFormat", hide: true },
          { id: "label", name: "Started at", format: "textFormat" },
          { id: "seconds", name: "Seconds, delivery to paid", format: "decimalFormat", formatOptions: { format: secs } },
        ],
      },
      {
        id: "summary",
        description: "Figures over all paid jobs.",
        data: [{ medianSeconds: median }],
        fields: [{ id: "medianSeconds", name: "Median time to paid", format: "decimalFormat", createValueFormatter: () => inSeconds, blankValue: "–" }],
      },
    ],
    relationships: [{ id: "paid-job", source: { tableId: "paid", fieldId: "jobId" }, target: { tableId: "jobs", fieldId: "id" }, type: "many-to-one" }],
    expressions: [
      measure("paidTotal", "Paid", "jobs.paidOut", money),
      measure("heldTotal", "Held", "jobs.heldNow", money),
      measure("returnedTotal", "Back to the client", "jobs.returned", money),
      ...VERDICT_MEASURES.map(([v, k]) => measure(`${k}Jobs`, VERDICT_WORDS[v], `jobs.${k}`, { format: "integerFormat" })),
    ],
  } as unknown as AgDataSourcesDefinition;
}

/* ---------- the report: KPIs, three charts, the jobs grid and the proof trail ---------- */

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const title = (text: string, subtitle?: string) => ({
  title: { enabled: true, text },
  ...(subtitle ? { subtitle: { enabled: true, text: subtitle } } : {}),
});
const kpi = (text: string, value: { id: string; aggregation?: "sum" | "countd" }, color: string) => ({
  type: "value" as const,
  dataMapping: { value: [value] },
  format: { ...title(text), style: { color, typography: { fontFamily: SERIF, fontSize: 40, fontWeight: "normal" as const, fontStyle: "normal" as const } }, crossFilter: "none" as const },
});

// Studio places widgets on a 24-column canvas; a phone gets one widget per row.
const LAPTOP = {
  "held-now": at(0, 0, 6, 6),
  "paid-out": at(6, 0, 6, 6),
  "median-secs": at(12, 0, 6, 6),
  jobs: at(18, 0, 6, 6),
  "money-by-job": at(0, 6, 9, 18),
  "seconds-to-paid": at(9, 6, 6, 18),
  verdicts: at(15, 6, 9, 18),
  grid: at(0, 24, 17, 30),
  proof: at(17, 24, 7, 30),
};
const PHONE = {
  "held-now": at(0, 0, 12, 6),
  "paid-out": at(12, 0, 12, 6),
  "median-secs": at(0, 6, 12, 6),
  jobs: at(12, 6, 12, 6),
  grid: at(0, 12, 24, 26),
  proof: at(0, 38, 24, 34),
  "money-by-job": at(0, 72, 24, 18),
  "seconds-to-paid": at(0, 90, 24, 16),
  verdicts: at(0, 106, 24, 16),
};
const tall = (layout: Record<string, AgWidgetLayoutState>) => Math.max(...Object.values(layout).map((l) => l.yTrack + l.ySpan)) * ROW + 24;
export const LEDGER_HEIGHT = { laptop: tall(LAPTOP), phone: tall(PHONE) };

// Below 720px of canvas, Studio asks for each widget's place; the widgets are matched by their laptop place.
const idAt = new Map(Object.entries(LAPTOP).map(([id, l]) => [`${l.xTrack},${l.yTrack}`, id as keyof typeof PHONE]));
export const ledgerBreakpoints: AgResponsiveLayoutBreakpoint[] = [
  { maxWidth: 719, layout: (widgets) => widgets.map((w) => PHONE[idAt.get(`${w.layout.xTrack},${w.layout.yTrack}`)!] ?? w.layout) },
];

export function ledgerReport(): AgReportState {
  return {
    selectedPageId: "ledger",
    pages: [
      {
        id: "ledger",
        widgets: {
          "held-now": kpi("Held now", { id: "heldTotal" }, "#a8650a"),
          "paid-out": kpi("Paid out", { id: "paidTotal" }, "#1f7a45"),
          "median-secs": kpi("Median to paid", { id: "summary.medianSeconds", aggregation: "sum" }, "#17171a"),
          jobs: kpi("Jobs", { id: "jobs.id", aggregation: "countd" }, "#17171a"),
          "money-by-job": {
            type: "bar-chart-stacked",
            dataMapping: { categoryKey: [{ id: "jobs.label" }], valueKey: [{ id: "paidTotal" }, { id: "heldTotal" }, { id: "returnedTotal" }] },
            format: { ...title("Money held against paid", "Each job: paid, held, or returned"), style: { theme: { common: { legend: { enabled: true } } } }, crossFilter: "highlight" },
          },
          "seconds-to-paid": {
            type: "column-chart-grouped",
            dataMapping: { categoryKey: [{ id: "paid.label" }], valueKey: [{ id: "paid.seconds", aggregation: "min" }] },
            format: { ...title("Seconds from delivery to paid", "Each job paid on a pass"), crossFilter: "highlight" },
          },
          verdicts: {
            type: "bar-chart-stacked",
            dataMapping: { categoryKey: [{ id: "jobs.day" }], valueKey: VERDICT_MEASURES.map(([, k]) => ({ id: `${k}Jobs` })) },
            format: { ...title("Latest verdict on each job", "Jobs by what the checker said last"), style: { theme: { common: { legend: { enabled: true, position: "right" } } } }, crossFilter: "highlight" },
          },
          grid: {
            type: "grid",
            dataMapping: {
              cols: [
                { id: "jobs.job" },
                { id: "jobs.money" },
                { id: "jobs.amount" },
                { id: "jobs.verdict" },
                { id: "jobs.secondsToPaid" },
                { id: "jobs.started" },
                { id: "jobs.hold" },
                { id: "jobs.capture" },
                { id: "jobs.payout" },
                { id: "jobs.id" },
              ],
            },
            sort: [{ field: { id: "jobs.started" }, direction: "desc" }],
            format: { ...title("Every job", "Click a row to see its proof"), style: { columnAutoSize: true }, crossFilter: "filter", triggerCrossFilter: true },
          },
          proof: {
            type: "proof-trail",
            dataMapping: { job: [{ id: "jobs.id" }] },
            format: { ...title("Proof trail"), crossFilter: "filter" },
          },
        },
        widgetLayout: LAPTOP,
        layout: { minWidth: 300 },
      },
    ],
  } as unknown as AgReportState;
}

/* ---------- the grid's cells: the same pills as the rest of Held ---------- */

const STATE_BY_WORD = Object.fromEntries(Object.entries(MONEY_WORDS).map(([k, w]) => [w, k])) as Record<string, LedgerRow["state"]>;
const VERDICT_BY_WORD = Object.fromEntries(Object.entries(VERDICT_WORDS).map(([k, w]) => [w, k])) as Record<string, LedgerRow["verdict"]>;

const MONEY_TEXT: Record<LedgerRow["state"], [string, string]> = {
  awaiting_hold: ["text-ink-3", "bg-ink-3"],
  held: ["text-held", "bg-held-dot"],
  paid: ["text-paid", "bg-paid-dot"],
  part_paid: ["text-paid", "bg-paid-dot"],
  cancelled: ["text-ink-3", "bg-ink-3"],
};
const VERDICT_TEXT: Record<LedgerRow["verdict"], [string, string]> = {
  checking: ["text-ink-2", "bg-ink-3"],
  passed: ["text-paid", "bg-paid-dot"],
  failed: ["text-fail", "bg-fail"],
  disagreed: ["text-ask", "bg-ask"],
  none: ["text-ink-3", "bg-line"],
};

function Dot({ word, tone }: { word: string; tone?: [string, string] }) {
  if (!tone) return null;
  return <span className={cx("text-[12px] font-semibold tracking-[0.08em] uppercase", tone[0])}>{word}</span>;
}
const MoneyCell = (p: CustomCellRendererProps) => <Dot word={p.value} tone={MONEY_TEXT[STATE_BY_WORD[p.value]]} />;
const VerdictCell = (p: CustomCellRendererProps) => <Dot word={p.value} tone={VERDICT_TEXT[VERDICT_BY_WORD[p.value]]} />;
function IdCell(p: CustomCellRendererProps) {
  return <span className="font-mono text-[12.5px] text-ink-2">{p.value || "–"}</span>;
}
const CELLS: Record<string, (p: CustomCellRendererProps) => React.ReactNode> = { money: MoneyCell, verdict: VerdictCell, id: IdCell };

/* ---------- the proof trail: the selected job's checks, quotes and PayPal IDs ---------- */

function ProofTrail(params: AgWidgetParams) {
  const { widgetApi, dataMapping } = params;
  // Ids of the jobs the page's filters leave, newest first, joined so an unchanged answer doesn't redraw.
  const [ids, setIds] = useState<string | null>(null);
  const field = (dataMapping as { job?: unknown[] }).job?.[0];
  // Studio refreshes the widget with new params when a filter or a row selection changes; ask again each time.
  useEffect(() => {
    if (!field) return;
    let live = true;
    widgetApi.getData({ fields: [field] } as never, { queryId: "proof" } as never).then((r) => {
      const res = r as { results: { rows: Record<string, string>[] }; replaced?: boolean };
      if (live && !res.replaced) setIds(res.results.rows.map((x) => Object.values(x)[0]).join(" "));
    });
    return () => {
      live = false;
    };
  }, [widgetApi, field, params]);
  if (ids === null) return <Quiet><Spinner /> Loading</Quiet>;
  const list = ids ? ids.split(" ") : [];
  if (list.length === 0) return <Quiet>No jobs to show.</Quiet>;
  const rows = (params.context as { rows: LedgerRow[] }).rows;
  const newest = rows.find((r) => list.includes(r.id))?.id ?? list[0];
  return <Proof id={newest} picked={list.length === 1} />;
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center gap-2 px-2 text-center text-[14px] text-ink-3">{children}</div>;
}

function Proof({ id, picked }: { id: string; picked: boolean }) {
  const { data: job, error } = useJob(id);
  if (error) return <Quiet>{error}</Quiet>;
  if (!job) return <Quiet><Spinner /> Loading the job</Quiet>;
  return <ProofBody job={job} picked={picked} />;
}

function ProofBody({ job, picked }: { job: Job; picked: boolean }) {
  const m = job.money;
  const last = job.deliveries.at(-1);
  const steps: { label: string; id?: string; note?: string; done: boolean }[] = [
    { label: "Hold placed", id: m.authorizationId, note: m.heldAt && when(m.heldAt), done: !!m.authorizationId },
    { label: m.state === "cancelled" ? "Hold cancelled" : "Money taken from the hold", id: m.captureId, note: m.cancelledAt ? when(m.cancelledAt) : m.capturedAmount && money(m.capturedAmount), done: !!m.captureId || m.state === "cancelled" },
    { label: "Paid to the freelancer", id: m.payoutBatchId, note: m.payoutStatus && (m.payoutStatus === "SUCCESS" ? "sent" : ["PENDING", "PROCESSING"].includes(m.payoutStatus) ? "sending" : m.payoutStatus.toLowerCase()), done: !!m.payoutBatchId },
  ];
  return (
    <div className="flex h-full flex-col overflow-auto px-2 pb-2 text-ink">
      <div className="font-mono text-[11px] tracking-[0.1em] text-ink-3 uppercase">{picked ? "The job you picked" : "The newest job. Click a row to pick another."}</div>
      <Link href={`/j/${job.id}`} className="mt-1.5 font-serif text-[19px] leading-snug font-medium hover:underline">
        {job.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MoneyPill state={m.state} className="!py-0.5" />
        {last && <OutcomePill outcome={last.outcome} className="!py-0.5" />}
        {last?.secondsToPaid != null && <span className="font-mono text-[12px] font-semibold text-paid">Paid in {seconds(last.secondsToPaid)}</span>}
      </div>

      <div className="mt-4 label">PayPal</div>
      <ol className="mt-1.5 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2.5">
            <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", s.done ? "bg-paid-dot" : "bg-line")} />
            <div className="min-w-0">
              <div className={cx("text-[13px] font-medium", !s.done && "text-ink-3")}>
                {s.label}
                {s.note && <span className="ml-1.5 font-normal text-ink-3">{s.note}</span>}
              </div>
              {s.id && <div className="truncate font-mono text-[12px] text-ink-2">{s.id}</div>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 label">{last ? `The checks on delivery ${job.deliveries.length}` : "The checks"}</div>
      <ul className="mt-1 font-mono text-[12.5px] leading-[1.45]">
        {job.checks.map((c, i) => {
          const a = last?.first.find((x) => x.checkId === c.id);
          const b = last?.second?.find((x) => x.checkId === c.id);
          const [word, tone] = !a ? ["—", "text-ink-3"] : a && b && a.pass !== b.pass ? ["Split", "text-ask"] : a.pass ? ["Pass", "text-paid"] : ["Fail", "text-fail"];
          return (
            <li key={c.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] gap-x-1.5 py-1">
              <span className="text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="min-w-0">{c.text}</span>
                <span className="leader" />
              </span>
              <span className={cx("font-semibold tracking-[0.08em] uppercase", tone)}>{word}</span>
              {a?.quote && a.quote !== "none found" && <span className="col-start-2 col-end-4 line-clamp-2 text-[11.5px] text-ink-2">“{a.quote.replace(/^[“"]|[”"]$/g, "")}”</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- widgets: Studio's own, with Held's cells, plus the proof trail ---------- */

export const ledgerWidgets = createWidgets({
  overrides: [
    {
      id: "grid",
      options: {
        createCellRenderer: (field: { context?: { cell?: string } }) => (field.context?.cell ? CELLS[field.context.cell] : undefined),
      },
    },
  ],
  additionalTypes: [
    {
      id: "proof-trail",
      label: "Proof trail",
      dataMapping: { job: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true } },
      form: (params: { createDefaults: (p: object) => unknown }) => params.createDefaults({ dataMappingItems: [{ key: "job", label: "Job" }] }),
      comp: ProofTrail,
      defaultSize: { width: 360, height: 480 },
      minSize: { width: 280, height: 320 },
    },
  ],
} as never);
