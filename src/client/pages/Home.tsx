import { Link } from "wouter";
import { useStats } from "../api";

export function Home() {
  const { data: s } = useStats();
  return (
    <section className="py-12">
      <h1 className="text-4xl font-bold">Paid the minute the work passes.</h1>
      <p className="mt-4 max-w-2xl text-lg">
        PayPal holds the client's money while the freelancer works. Claude checks the delivered work against the brief both sides agreed. The moment it passes, PayPal takes the hold and pays the freelancer.
      </p>
      <Link href="/new?example=1" className="mt-8 inline-block rounded bg-black px-5 py-3 text-white">Try it with the example job</Link>
      <dl className="mt-12 grid grid-cols-3 gap-6">
        <div><dt className="text-sm">Jobs paid</dt><dd className="text-3xl font-bold">{s?.jobsPaid ?? "–"}</dd></div>
        <div><dt className="text-sm">Median seconds, delivery to paid</dt><dd className="text-3xl font-bold">{s?.medianSecondsToPaid ?? "–"}</dd></div>
        <div><dt className="text-sm">Test set verdicts right</dt><dd className="text-3xl font-bold">{s?.benchTotal ? `${s.benchRight} of ${s.benchTotal}` : "–"}</dd></div>
      </dl>
    </section>
  );
}
