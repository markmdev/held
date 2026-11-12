import { Link } from "wouter";
import { useLedger } from "../api";
import { Page } from "../components/ui";

// The Hackathon Designer replaces this with the AG Studio dashboard.
export function Ledger() {
  const { data: rows, error } = useLedger();
  if (error) return <Page><p className="py-8">{error}</p></Page>;
  return (
    <Page>
    <section className="py-8">
      <h1 className="text-2xl font-bold">Ledger</h1>
      <table className="mt-4 w-full text-sm">
        <thead><tr className="text-left"><th>Job</th><th>State</th><th>Amount</th><th>Verdict</th><th>Seconds to paid</th><th>Hold</th><th>Capture</th><th>Payout</th></tr></thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id}><td><Link href={`/j/${r.id}`} className="underline">{r.title}</Link></td><td>{r.state}</td><td>${r.amount}</td><td>{r.verdict}</td><td>{r.secondsToPaid ?? ""}</td><td>{r.authorizationId}</td><td>{r.captureId}</td><td>{r.payoutBatchId}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
    </Page>
  );
}
