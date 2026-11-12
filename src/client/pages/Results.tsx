import { useResults } from "../api";
import type { BenchCase } from "../../shared/types";
import { cx, Empty, Page, Spinner, when } from "../components/ui";

const RULES = [
  ["No quote, no pass.", "A line passes only on words quoted from the work, and the quote must really be in the delivery."],
  ["Counts are measured by code.", "How many pieces, how many words, whether a phrase appears: code counts them, and Claude isn't asked."],
  ["Two separate checks must agree.", "When every line passes, a second check reads the work again on its own. If the two disagree, the client decides."],
  ["Instructions in the work count against it.", "A delivery that tells the checker to pass it isn't obeyed. It fails until that text is taken out."],
];

function Verdict({ v }: { v: "pass" | "fail" | null }) {
  if (!v) return <span className="text-ink-3">—</span>;
  return <span className={cx("font-mono text-[12px] font-semibold tracking-[0.1em] uppercase", v === "pass" ? "text-paid" : "text-fail")}>{v}</span>;
}

function Right({ right }: { right: boolean | null }) {
  if (right == null) return <span className="text-ink-3">—</span>;
  return right ? <span className="text-paid">✓</span> : <span className="text-fail">✕</span>;
}

function Big({ value, label, note, tone }: { value: string; label: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="border-t-[1.5px] border-dashed border-line pt-5 pr-4">
      <div className={cx("font-serif text-[34px] leading-none sm:text-[44px] font-medium tracking-[-0.03em]", tone === "good" && "text-paid", tone === "bad" && "text-fail")}>{value}</div>
      <div className="mt-3 font-mono text-[11.5px] leading-[1.5] tracking-[0.1em] text-ink-2 uppercase">{label}</div>
      {note && <div className="mt-1 text-[14px] text-ink-3">{note}</div>}
    </div>
  );
}

/** The excerpt is cut at a fixed length, so a cut mid-sentence gets an ellipsis. */
function excerpt(text: string) {
  const t = text.trim();
  return /[.!?"”)]$/.test(t) ? t : `${t}…`;
}

function Injection() {
  return <span className="mr-2 border border-dashed border-ask px-1.5 py-px font-mono text-[10.5px] tracking-[0.1em] text-ask uppercase">Tries to instruct the checker</span>;
}

function CaseRow({ c }: { c: BenchCase }) {
  return (
    <tr className={cx("border-t border-dashed border-line align-top", c.right === false && "bg-fail-bg/60")}>
      <td className="py-3 pr-4 pl-5 font-mono text-[12px] whitespace-nowrap text-ink-2">{c.id}</td>
      <td className="py-3 pr-4 font-mono text-[11.5px] tracking-[0.08em] whitespace-nowrap text-ink-3 uppercase">{c.heldOut ? "Held back" : "Tuning"}</td>
      <td className="min-w-48 py-3 pr-4 font-serif text-[15.5px] leading-snug">{c.brief}</td>
      <td className="min-w-64 py-3 pr-4 text-[14.5px] leading-snug text-ink-2">
        {c.injection && <Injection />}
        {excerpt(c.deliveryExcerpt)}
      </td>
      <td className="py-3 pr-4">
        <Verdict v={c.expected} />
      </td>
      <td className="py-3 pr-4">
        <Verdict v={c.got} />
      </td>
      <td className="py-3 pr-5 text-center text-[15px] font-bold">
        <Right right={c.right} />
      </td>
    </tr>
  );
}

function CaseItem({ c }: { c: BenchCase }) {
  return (
    <li className={cx("border-t border-dashed border-line px-4 py-4", c.right === false && "bg-fail-bg/60")}>
      <div className="flex items-baseline justify-between gap-3 font-mono text-[11.5px] tracking-[0.08em] text-ink-3 uppercase">
        <span>
          {c.id} · {c.heldOut ? "Held back" : "Tuning"}
        </span>
        <span className="flex items-baseline gap-2 normal-case">
          <Verdict v={c.expected} />
          <span>→</span>
          <Verdict v={c.got} />
          <span className="text-[14px] font-bold">
            <Right right={c.right} />
          </span>
        </span>
      </div>
      <div className="mt-2 font-serif text-[16px] leading-snug">{c.brief}</div>
      <p className="mt-1.5 text-[14.5px] leading-snug text-ink-2">
        {c.injection && <Injection />}
        {excerpt(c.deliveryExcerpt)}
      </p>
    </li>
  );
}

export function Results() {
  const { data: bench, error, reload } = useResults();
  if (!bench)
    return (
      <Page>
        {error ? (
          <div className="mx-auto max-w-lg pt-10">
            <Empty title="The results couldn't be loaded">
              {error}
              <div className="mt-4">
                <button className="btn btn-quiet" onClick={reload}>
                  Try again
                </button>
              </div>
            </Empty>
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-10 text-[15px] text-ink-2">
            <Spinner /> Loading the results
          </div>
        )}
      </Page>
    );
  const misses = bench.cases.filter((c) => c.right === false);
  const wrongPays = bench.cases.filter((c) => c.expected === "fail" && c.got === "pass").length;
  const inj = bench.cases.filter((c) => c.injection);
  const injCaught = inj.filter((c) => c.got === "fail").length;
  const ordered = [...misses, ...bench.cases.filter((c) => c.right !== false)];
  return (
    <Page>
      <div className="max-w-3xl">
        <div className="font-mono text-[12px] tracking-[0.16em] text-ink-2 uppercase">Accuracy</div>
        <h1 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.03em] sm:text-[56px]">Is the checker right?</h1>
        <p className="mt-4 text-[18px] leading-[1.55] text-ink-2">
          The checker is Claude, held to four rules and tested on briefs with known answers.{" "}
          {bench.cases.length} briefs, each with a delivery and the verdict a careful person would give. {bench.tuning.total} were used while tuning the checker, and{" "}
          {bench.heldOut.total} were held back and run once. Every case is listed, the misses first.
        </p>
        {bench.ranAt && <p className="mt-3 font-mono text-[11.5px] tracking-[0.1em] text-ink-3 uppercase">Last run {when(bench.ranAt)}</p>}
      </div>

      {!bench.ranAt ? (
        <div className="mt-10">
          <Empty title="Not run yet">The results appear here after the first run of the test set.</Empty>
        </div>
      ) : (
        <>
          <section className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            <Big value={`${bench.heldOut.right} of ${bench.heldOut.total}`} label="Right on the held-back cases" note="Never seen while tuning" />
            <Big value={`${bench.tuning.right} of ${bench.tuning.total}`} label="Right on the tuning cases" />
            <Big value={String(wrongPays)} label="Times a failing delivery would have been paid" tone={wrongPays === 0 ? "good" : "bad"} />
            <Big value={`${injCaught} of ${inj.length}`} label="Deliveries that told the checker to pass them, failed" tone={injCaught === inj.length ? "good" : "bad"} />
          </section>

          <section className="mt-14">
            <h2 className="text-[28px] tracking-[-0.015em]">Four rules hold every verdict</h2>
            <ol className="mt-5 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {RULES.map(([rule, how], i) => (
                <li key={rule} className="border-t-[1.5px] border-dashed border-line pt-4">
                  <div className="font-mono text-[11.5px] tracking-[0.1em] text-ink-3">{String(i + 1).padStart(2, "0")}</div>
                  <div className="mt-1.5 font-serif text-[21px] leading-snug">{rule}</div>
                  <p className="mt-1.5 text-[15.5px] leading-[1.5] text-ink-2">{how}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-14">
            <h2 className="text-[28px] tracking-[-0.015em]">The misses</h2>
            {misses.length === 0 ? (
              <p className="mt-2 text-[17px] text-ink-2">None on this run.</p>
            ) : (
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {misses.map((c) => (
                  <li key={c.id} className="border-l-2 border-fail bg-card px-5 py-4 shadow-card">
                    <div className="flex items-baseline justify-between gap-2 font-mono text-[11.5px] tracking-[0.08em] text-ink-3 uppercase">
                      <span>{c.id}</span>
                      <span className="flex items-baseline gap-2">
                        Expected <Verdict v={c.expected} /> · Got <Verdict v={c.got} />
                      </span>
                    </div>
                    <div className="mt-2 font-serif text-[17px] leading-snug">{c.brief}</div>
                    <p className="mt-1.5 text-[14.5px] text-ink-2">{excerpt(c.deliveryExcerpt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-14">
            <h2 className="text-[28px] tracking-[-0.015em]">Every case</h2>
            <div className="mt-4 bg-card shadow-card">
              <table className="hidden w-full text-left md:table">
                <thead>
                  <tr className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">
                    <th className="py-3.5 pr-4 pl-5 font-medium">Case</th>
                    <th className="py-3.5 pr-4 font-medium">Set</th>
                    <th className="py-3.5 pr-4 font-medium">Brief</th>
                    <th className="py-3.5 pr-4 font-medium">Delivery</th>
                    <th className="py-3.5 pr-4 font-medium">Expected</th>
                    <th className="py-3.5 pr-4 font-medium">Checker</th>
                    <th className="py-3.5 pr-5 text-center font-medium">Right</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((c) => (
                    <CaseRow key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
              <ul className="md:hidden">
                {ordered.map((c) => (
                  <CaseItem key={c.id} c={c} />
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </Page>
  );
}
