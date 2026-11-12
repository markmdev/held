import { useResults } from "../api";
import type { BenchCase } from "../../shared/types";
import { cx, Empty, Page, Spinner, when } from "../components/ui";

function Verdict({ v }: { v: "pass" | "fail" | null }) {
  if (!v) return <span className="text-ink-3">–</span>;
  return <span className={cx("rounded-full px-2 py-0.5 text-[12.5px] font-bold", v === "pass" ? "bg-paid-bg text-paid" : "bg-fail-bg text-fail")}>{v === "pass" ? "Pass" : "Fail"}</span>;
}

function Big({ value, label, note, tone }: { value: string; label: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card px-5 py-4">
      <div className={cx("text-[34px] leading-tight font-[750] tracking-[-0.03em]", tone === "good" && "text-paid", tone === "bad" && "text-fail")}>{value}</div>
      <div className="mt-1 text-[14.5px] font-semibold">{label}</div>
      {note && <div className="mt-0.5 text-[12.5px] text-ink-3">{note}</div>}
    </div>
  );
}

function CaseRow({ c }: { c: BenchCase }) {
  return (
    <tr className={cx("border-t border-line-2 align-top", c.right === false && "bg-fail-bg/40")}>
      <td className="py-2.5 pr-3 pl-4 font-mono text-[12.5px] whitespace-nowrap text-ink-2">{c.id}</td>
      <td className="py-2.5 pr-3 text-[13px] whitespace-nowrap text-ink-2">{c.heldOut ? "Held back" : "Tuning"}</td>
      <td className="min-w-48 py-2.5 pr-3 text-[14px]">{c.brief}</td>
      <td className="min-w-64 py-2.5 pr-3 text-[13.5px] text-ink-2">
        {c.injection && <span className="mr-1.5 rounded bg-ask-bg px-1.5 py-0.5 text-[11px] font-bold text-ask">Tries to instruct the checker</span>}
        {c.deliveryExcerpt}
      </td>
      <td className="py-2.5 pr-3">
        <Verdict v={c.expected} />
      </td>
      <td className="py-2.5 pr-3">
        <Verdict v={c.got} />
      </td>
      <td className="py-2.5 pr-4 text-center text-[15px] font-black">
        {c.right == null ? <span className="text-ink-3">–</span> : c.right ? <span className="text-paid">✓</span> : <span className="text-fail">✕</span>}
      </td>
    </tr>
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
  return (
    <Page>
      <div className="max-w-3xl">
        <h1 className="text-[34px] leading-tight font-[750] sm:text-[42px]">Accuracy</h1>
        <p className="mt-2 text-[17px] leading-relaxed text-ink-2">
          {bench.cases.length} briefs, each with a delivery and the verdict a careful person would give. {bench.tuning.total} were used while tuning the checker, and{" "}
          {bench.heldOut.total} were held back and run once. Every case is listed, the misses first.
        </p>
        <p className="mt-2 text-[14px] text-ink-3">
          {bench.ranAt ? <>Last run {when(bench.ranAt)}.</> : null}
        </p>
      </div>

      {!bench.ranAt ? (
        <div className="mt-8">
          <Empty title="Not run yet">The results appear here after the first run of the test set.</Empty>
        </div>
      ) : (
        <>
          <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Big value={`${bench.heldOut.right} of ${bench.heldOut.total}`} label="Right on the held-back cases" note="Never seen while tuning" />
            <Big value={`${bench.tuning.right} of ${bench.tuning.total}`} label="Right on the tuning cases" />
            <Big value={String(wrongPays)} label="Times a failing delivery would have been paid" tone={wrongPays === 0 ? "good" : "bad"} />
            <Big value={`${injCaught} of ${inj.length}`} label="Deliveries that told the checker to pass them, failed" tone={injCaught === inj.length ? "good" : "bad"} />
          </section>

          <section className="mt-8">
            <h2 className="text-[22px] font-[750]">The misses</h2>
            {misses.length === 0 ? (
              <p className="mt-2 text-[15px] text-ink-2">None on this run.</p>
            ) : (
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {misses.map((c) => (
                  <li key={c.id} className="card border-fail/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12.5px] text-ink-2">{c.id}</span>
                      <span className="text-[13px] text-ink-2">
                        expected <Verdict v={c.expected} /> got <Verdict v={c.got} />
                      </span>
                    </div>
                    <div className="mt-2 text-[15px] font-semibold">{c.brief}</div>
                    <p className="mt-1 text-[14px] text-ink-2">{c.deliveryExcerpt}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-[22px] font-[750]">Every case</h2>
            <div className="card mt-3 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
                    <th className="py-3 pr-3 pl-4">Case</th>
                    <th className="py-3 pr-3">Set</th>
                    <th className="py-3 pr-3">Brief</th>
                    <th className="py-3 pr-3">Delivery</th>
                    <th className="py-3 pr-3">Expected</th>
                    <th className="py-3 pr-3">Checker</th>
                    <th className="py-3 pr-4 text-center">Right</th>
                  </tr>
                </thead>
                <tbody>
                  {[...misses, ...bench.cases.filter((c) => c.right !== false)].map((c) => (
                    <CaseRow key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Page>
  );
}
