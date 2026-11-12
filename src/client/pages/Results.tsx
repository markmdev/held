import { useResults } from "../api";

export function Results() {
  const { data: r, error } = useResults();
  if (error) return <p className="py-8">{error}</p>;
  if (!r) return <p className="py-8">Loading…</p>;
  return (
    <section className="py-8">
      <h1 className="text-2xl font-bold">Test results</h1>
      {!r.ranAt ? <p className="mt-4">The test set hasn't run yet.</p> : (
        <>
          <p className="mt-4">Run {new Date(r.ranAt).toLocaleString()}. While tuning: {r.tuning.right} of {r.tuning.total} right. Held back and run once: {r.heldOut.right} of {r.heldOut.total} right.</p>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left"><th>Case</th><th>Brief</th><th>Expected</th><th>Got</th><th>Right</th><th>Set</th></tr></thead>
            <tbody>
              {r.cases.map((c) => (
                <tr key={c.id}><td>{c.id}{c.injection ? " (tries to instruct the checker)" : ""}</td><td>{c.brief.slice(0, 80)}</td><td>{c.expected}</td><td>{c.got ?? "–"}</td><td>{c.right === null ? "–" : c.right ? "✓" : "✗ miss"}</td><td>{c.heldOut ? "held back" : "tuning"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
