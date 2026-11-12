import { useEffect, useRef, useState } from "react";
import { authorize, createOrder, useConfig } from "../api";
import type { Job } from "../../shared/types";
import { Spinner } from "./ui";

declare global {
  interface Window { paypal?: { Buttons: (o: object) => { render: (el: HTMLElement) => Promise<void>; close: () => void } } }
}

let sdk: Promise<void> | null = null;
function loadSdk(clientId: string) {
  sdk ??= new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&intent=authorize&currency=USD&components=buttons&disable-funding=card,credit,paylater,venmo`;
    s.onload = () => ok();
    s.onerror = () => bad(new Error("PayPal's window didn't load."));
    document.head.appendChild(s);
  });
  return sdk;
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[13px] text-ink-2">{label}</span>
      <button
        className="flex min-w-0 items-center gap-2 rounded-[3px] px-1.5 py-0.5 font-mono text-[13px] hover:bg-line-2"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        <span className="truncate">{value}</span>
        <span className={copied ? "text-[10.5px] tracking-[0.12em] text-paid uppercase" : "text-[10.5px] tracking-[0.12em] text-ink-3 uppercase"}>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

// The client approves the hold in PayPal's own window; Held then places it.
export function PayPalHold({ job, onHeld }: { job: Job; onHeld: (j: Job) => void }) {
  const config = useConfig();
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config?.paypalClientId || !box.current) return;
    let buttons: { close: () => void } | null = null;
    loadSdk(config.paypalClientId)
      .then(() => {
        if (!box.current || !window.paypal) return;
        const b = window.paypal.Buttons({
          style: { layout: "horizontal", label: "paypal", tagline: false, height: 45, shape: "rect" },
          createOrder: async () => (await createOrder(job.id)).orderId,
          onApprove: async () => onHeld(await authorize(job.id)),
          onError: (e: Error) => setError(e.message || "PayPal couldn't place the hold."),
        });
        buttons = b;
        return b.render(box.current).then(() => setReady(true));
      })
      .catch((e: Error) => setError(e.message));
    return () => buttons?.close();
  }, [config?.paypalClientId, job.id, onHeld]);

  if (config && !config.paypalClientId)
    return <p className="rounded-[3px] bg-off-bg px-3.5 py-3 text-[14.5px] text-ink-2">PayPal isn't connected yet, so the hold can't be placed. Try again later.</p>;
  return (
    <div>
      {!ready && !error && (
        <div className="flex h-[45px] items-center gap-2 text-[14px] text-ink-3">
          <Spinner /> Loading PayPal
        </div>
      )}
      <div ref={box} />
      {config?.sandboxBuyer && (
        <div className="mt-4 rounded-[3px] border border-dashed border-line bg-paper px-4 py-3">
          <div className="label">Log in to PayPal with</div>
          <CopyLine label="Email" value={config.sandboxBuyer.email} />
          <CopyLine label="Password" value={config.sandboxBuyer.password} />
          <div className="mt-1 text-[12px] leading-relaxed text-ink-3">A test buyer in PayPal's sandbox. Its money isn't real.</div>
        </div>
      )}
      {error && <p className="mt-3 rounded-[3px] bg-fail-bg px-3.5 py-3 text-[14px] text-fail">{error}</p>}
    </div>
  );
}
