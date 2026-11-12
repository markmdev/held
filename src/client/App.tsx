import { lazy, Suspense } from "react";
import { Link, Route, Switch } from "wouter";
import { Empty, Page, Spinner } from "./components/ui";
import { Home } from "./pages/Home";
import { JobPage } from "./pages/JobPage";
import { NewJob } from "./pages/NewJob";
import { Results } from "./pages/Results";

const Ledger = lazy(() => import("./pages/Ledger").then((m) => ({ default: m.Ledger })));

function LedgerPage() {
  return (
    <Suspense
      fallback={
        <Page>
          <div className="flex items-center gap-3 pt-10 text-[15px] text-ink-2">
            <Spinner /> Loading the ledger
          </div>
        </Page>
      }
    >
      <Ledger />
    </Suspense>
  );
}

export function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/new" component={NewJob} />
      <Route path="/j/:id">{(p) => <JobPage id={p.id} />}</Route>
      <Route path="/ledger" component={LedgerPage} />
      <Route path="/results" component={Results} />
      <Route>
        <Page>
          <div className="mx-auto max-w-lg pt-10">
            <Empty title="Nothing at this address">
              <Link href="/" className="font-semibold text-ink underline">
                Go to Held's home page
              </Link>
            </Empty>
          </div>
        </Page>
      </Route>
    </Switch>
  );
}
