import { Link, Route, Switch } from "wouter";
import { Empty, Page } from "./components/ui";
import { Home } from "./pages/Home";
import { JobPage } from "./pages/JobPage";
import { Ledger } from "./pages/Ledger";
import { NewJob } from "./pages/NewJob";
import { Results } from "./pages/Results";

export function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/new" component={NewJob} />
      <Route path="/j/:id">{(p) => <JobPage id={p.id} />}</Route>
      <Route path="/ledger" component={Ledger} />
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
