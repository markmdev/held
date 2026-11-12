import { Link, Route, Switch } from "wouter";
import { Home } from "./pages/Home";
import { JobPage } from "./pages/JobPage";
import { Ledger } from "./pages/Ledger";
import { NewJob } from "./pages/NewJob";
import { Results } from "./pages/Results";

export function App() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-4">
        <Link href="/" className="font-bold">Held</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/new">New job</Link>
          <Link href="/ledger">Ledger</Link>
          <Link href="/results">Results</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/new" component={NewJob} />
          <Route path="/j/:id">{(p) => <JobPage id={p.id} />}</Route>
          <Route path="/ledger" component={Ledger} />
          <Route path="/results" component={Results} />
          <Route>Nothing here.</Route>
        </Switch>
      </main>
    </div>
  );
}
