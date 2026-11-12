import { useEffect, useRef, useState } from "react";
import { authorize, createOrder, useConfig } from "../api";
import type { Job } from "../../shared/types";

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

// The client approves the hold in PayPal's own window; Held then places it.
export function PayPalHold({ job, onHeld }: { job: Job; onHeld: (j: Job) => void }) {
  const config = useConfig();
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config?.paypalClientId || !box.current) return;
    let buttons: { close: () => void } | null = null;
    loadSdk(config.paypalClientId)
      .then(() => {
        if (!box.current || !window.paypal) return;
        const b = window.paypal.Buttons({
          style: { layout: "horizontal", label: "paypal", tagline: false, height: 45 },
          createOrder: async () => (await createOrder(job.id)).orderId,
          onApprove: async () => onHeld(await authorize(job.id)),
          onError: (e: Error) => setError(e.message || "PayPal couldn't place the hold."),
        });
        buttons = b;
        return b.render(box.current);
      })
      .catch((e: Error) => setError(e.message));
    return () => buttons?.close();
  }, [config?.paypalClientId, job.id, onHeld]);

  if (config && !config.paypalClientId) return <p>PayPal isn't connected yet.</p>;
  return (
    <div>
      <div ref={box} />
      {config?.sandboxBuyer && (
        <p className="mt-2 text-sm">
          Sandbox buyer login: <code>{config.sandboxBuyer.email}</code> / <code>{config.sandboxBuyer.password}</code> (PayPal's test money)
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
