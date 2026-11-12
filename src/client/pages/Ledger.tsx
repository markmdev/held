import { AgStudioAiModule, AgStudioModuleRegistry, createAiHarness, enableStudioDevValidations, type AgAiHarnessSetup, type AgStudioApi } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { claudeAdapter } from "../agent";
import { useLedger } from "../api";
import { heldTheme, ledgerData, ledgerLayout, ledgerWidgets } from "../components/studio";
import { Empty, Page, Spinner } from "../components/ui";

if (import.meta.env.DEV) enableStudioDevValidations();
AgStudioModuleRegistry.registerModules([AgStudioAiModule]);

const AS_NEW = " Add a new widget for it at the bottom of the page and leave the other widgets as they are.";
const QUESTIONS = [
  { label: "Which jobs failed, and why?", prompt: "Which jobs failed their checks, and why?" + AS_NEW },
  { label: "How fast were jobs paid?", prompt: "How many seconds did each paid job take from delivery to paid?" + AS_NEW },
  { label: "Where is the money now?", prompt: "How much money is held, paid out and back with the client right now?" + AS_NEW },
];

// The ledger's agent: AG Studio's own agents, on Claude through Held's worker.
const agent: AgAiHarnessSetup = ({ api }) => createAiHarness(api as AgStudioApi, { adapter: claudeAdapter, primary: "lead", promptStarters: QUESTIONS });

const CHAT_WORDS = { panelTitleAi: "Ask about the ledger", aiMessageInputPlaceholder: "Ask a question about these jobs", aiNewChat: "New question", aiSubmitButton: "Ask" };

export function Ledger() {
  const { data: rows, error, reload } = useLedger();
  const data = useMemo(() => (rows ? ledgerData(rows) : undefined), [rows]);
  const jobs = rows?.length ?? 0;
  const layout = useMemo(() => ledgerLayout(jobs), [jobs]);
  const [asking, setAsking] = useState(false);
  const studio = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (asking) studio.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else studio.current?.querySelector(".ag-studio-layout")?.scrollTo({ top: 0 });
  }, [asking]);

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
            {/* While the chat is open the button and the dashboard together fill the screen under the top bar,
                so the question box stays in view and the canvas scrolls inside. */}
            <div ref={studio} className="scroll-mt-[76px]">
              <div className="mb-3 flex min-h-11 items-center justify-between gap-4">
                <span className="font-mono text-[11.5px] tracking-[0.12em] text-ink-2 uppercase">Built with AG Studio · click a bar or a row to filter</span>
                <button className="btn btn-quiet hidden shrink-0 min-[720px]:inline-flex" onClick={() => setAsking((a) => !a)}>
                  {asking ? "Done asking" : "Ask about the ledger"}
                </button>
              </div>
              <div
                className={asking ? "-mx-[14px] h-[calc(100dvh-152px)]" : "-mx-[14px] h-(--phone) md:h-(--laptop)"}
                style={{ "--phone": `${layout.height.phone}px`, "--laptop": `${layout.height.laptop}px` } as CSSProperties}
              >
                <AgStudio
                  key={jobs}
                  theme={heldTheme}
                  data={data}
                  initialState={layout.report}
                  widgets={ledgerWidgets}
                  context={{ rows }}
                  mode={asking ? "edit" : "view"}
                  panels={{ view: { left: [], right: [] }, edit: { left: [], right: ["ai"] } }}
                  ai={agent}
                  localeText={CHAT_WORDS}
                  responsiveLayoutBreakpoints={layout.breakpoints}
                  style={{ height: "100%" }}
                />
              </div>
            </div>
          </AgStudioProvider>
        )}
      </div>
    </Page>
  );
}
