import type { Check, Verdict } from "../shared/types";
import type { CheckOutput } from "./claude";
import type { Measured } from "./measure";

const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’'`]/g, "").replace(/[‐-―-]/g, "-").replace(/\s+/g, " ").trim();

// The rules that hold a verdict, whatever the model said: code's counts decide measured checks, a pass needs
// a quote (unless the check is that something is absent), a quote must really be in the delivery or in the
// facts code measured about it, and text addressed to the checker fails the delivery.
export function settle(checks: Check[], measured: Record<string, Measured>, out: CheckOutput, text: string | null, form: string[]) {
  const facts = norm(form.join(" "));
  const verdicts: Verdict[] = checks.map((c) => {
    const m = measured[c.id];
    if (m) return { checkId: c.id, pass: m.pass, quote: m.quote, reason: m.fact };
    const v = out.verdicts.find((x) => x.checkId === c.id);
    if (!v) return { checkId: c.id, pass: false, quote: "", reason: "The checker gave no verdict for this check." };
    const quote = (v.quote ?? "").trim();
    if (v.pass && !quote && !v.about_absence) return { checkId: c.id, pass: false, quote, reason: "A pass needs words quoted from the delivery, and none were." };
    if (v.pass && !quote) return { checkId: c.id, pass: true, quote, reason: v.reason ?? "" };
    if (v.pass && text !== null && !norm(text).includes(norm(quote).replace(/…$/, "")) && !facts.includes(norm(quote)))
      return { checkId: c.id, pass: false, quote, reason: "The quoted words aren't in the delivery." };
    return { checkId: c.id, pass: !!v.pass, quote, reason: v.reason ?? "" };
  });
  const missing = out.missing.map((s) => s.trim()).filter(Boolean);
  if (!missing.length) for (const v of verdicts) if (!v.pass) missing.push(`${checks.find((x) => x.id === v.checkId)!.text}: ${v.reason}`);
  if (out.injection) missing.unshift(`Take out the text addressed to the checker: “${out.injection.slice(0, 200)}”`);
  const allPass = !out.injection && verdicts.every((v) => v.pass);
  return { verdicts, missing: allPass ? [] : missing, allPass };
}
