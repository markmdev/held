import { enableStudioDevValidations } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { useMemo, type CSSProperties } from "react";
import { Link } from "wouter";
import { useLedger } from "../api";
import { heldTheme, LEDGER_HEIGHT, ledgerBreakpoints, ledgerData, ledgerReport, ledgerWidgets } from "../components/studio";
import { Empty, Page, Spinner } from "../components/ui";

if (import.meta.env.DEV) enableStudioDevValidations();

export function Ledger() {
  const { data: rows, error, reload } = useLedger();
  const data = useMemo(() => (rows ? ledgerData(rows) : undefined), [rows]);
  const initialState = useMemo(ledgerReport, []);

  return (
    <Page>
      <div className="max-w-3xl">
        <div className="font-mono text-[12px] tracking-[0.16em] text-ink-2 uppercase">Ledger</div>
        <h1 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.03em] sm:text-[56px]">Where's the money?</h1>
        <p className="mt-4 text-[18px] leading-[1.55] text-ink-2">
          Every job on Held: what PayPal holds, what it has paid, how fast, and what the checker said. Each row carries PayPal's own IDs.
        </p>
      </div>
      <div className="mt-9">
        {error && !rows ? (
          <Empty title="The ledger couldn't be loaded">
            {error}
            <div className="mt-4">
              <button className="btn btn-quiet" onClick={reload}>
                Try again
              </button>
            </div>
          </Empty>
        ) : !rows || !data ? (
          <div className="flex items-center gap-3 text-[15px] text-ink-2">
            <Spinner /> Loading the ledger
          </div>
        ) : rows.length === 0 ? (
          <Empty title="No jobs yet">
            The first job shows here once its money is held.{" "}
            <Link href="/new?example=1" className="font-semibold text-ink underline">
              Try a sample job
            </Link>
          </Empty>
        ) : (
          <AgStudioProvider>
            <div className="-mx-[14px] h-(--phone) md:h-(--laptop)" style={{ "--phone": `${LEDGER_HEIGHT.phone}px`, "--laptop": `${LEDGER_HEIGHT.laptop}px` } as CSSProperties}>
              <AgStudio
                theme={heldTheme}
                data={data}
                initialState={initialState}
                widgets={ledgerWidgets}
                context={{ rows }}
                mode="view"
                panels={{ view: { left: [], right: [] } }}
                responsiveLayoutBreakpoints={ledgerBreakpoints}
                style={{ height: "100%" }}
              />
            </div>
          </AgStudioProvider>
        )}
      </div>
    </Page>
  );
}
