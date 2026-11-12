export type PayPalEnv = { PAYPAL_API: string; PAYPAL_CLIENT_ID: string; PAYPAL_CLIENT_SECRET: string };

let cached: { token: string; until: number } | null = null;

async function token(env: PayPalEnv): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${env.PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) throw new PayPalError(`PayPal sign-in failed: ${body.error_description ?? res.status}`);
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 300) * 1000 };
  return cached.token;
}

export class PayPalError extends Error {}

async function call<T>(env: PayPalEnv, method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
  const res = await fetch(`${env.PAYPAL_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await token(env)}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(requestId ? { "paypal-request-id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.details?.[0]?.description ?? json?.message ?? json?.error_description ?? res.statusText;
    throw new PayPalError(`PayPal ${method} ${path.split("?")[0]} answered ${res.status}: ${detail}`);
  }
  return json as T;
}

export async function createOrder(env: PayPalEnv, jobId: string, title: string, amount: string) {
  const o = await call<{ id: string }>(env, "POST", "/v2/checkout/orders", {
    intent: "AUTHORIZE",
    purchase_units: [{ reference_id: jobId, description: `Held: ${title}`.slice(0, 127), amount: { currency_code: "USD", value: amount } }],
    payment_source: { paypal: { experience_context: { brand_name: "Held", user_action: "CONTINUE", shipping_preference: "NO_SHIPPING" } } },
  }, `order-${jobId}`);
  return o.id;
}

export async function authorizeOrder(env: PayPalEnv, orderId: string) {
  const o = await call<{ purchase_units: { payments?: { authorizations?: { id: string; status: string; expiration_time?: string }[] } }[] }>(env, "POST", `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
  const a = o.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!a) throw new PayPalError("PayPal returned no hold for this order.");
  return { id: a.id, expiresAt: a.expiration_time ?? null };
}

export async function capture(env: PayPalEnv, authorizationId: string, amount: string | null, requestId: string) {
  const c = await call<{ id: string; status: string; amount?: { value: string } }>(
    env,
    "POST",
    `/v2/payments/authorizations/${authorizationId}/capture`,
    { final_capture: true, ...(amount ? { amount: { currency_code: "USD", value: amount } } : {}) },
    requestId,
  );
  return { id: c.id, status: c.status, amount: c.amount?.value ?? amount };
}

export async function voidHold(env: PayPalEnv, authorizationId: string) {
  await call(env, "POST", `/v2/payments/authorizations/${authorizationId}/void`, undefined, `void-${authorizationId}`);
}

export async function payout(env: PayPalEnv, jobId: string, email: string, amount: string, requestId: string) {
  const p = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>(env, "POST", "/v1/payments/payouts", {
    sender_batch_header: { sender_batch_id: requestId, email_subject: "You've been paid through Held", email_message: "The work passed every agreed check." },
    items: [{ recipient_type: "EMAIL", amount: { value: amount, currency: "USD" }, receiver: email, note: `Held job ${jobId}`, sender_item_id: jobId }],
  }, requestId);
  return { batchId: p.batch_header.payout_batch_id, status: p.batch_header.batch_status };
}

export async function payoutStatus(env: PayPalEnv, batchId: string) {
  const p = await call<{ batch_header: { batch_status: string; time_completed?: string }; items?: { transaction_status?: string; time_processed?: string }[] }>(env, "GET", `/v1/payments/payouts/${batchId}`);
  const item = p.items?.[0];
  return { status: item?.transaction_status ?? p.batch_header.batch_status, doneAt: item?.time_processed ?? p.batch_header.time_completed ?? null };
}

export async function verifyWebhook(env: PayPalEnv & { PAYPAL_WEBHOOK_ID?: string }, headers: Headers, event: unknown) {
  if (!env.PAYPAL_WEBHOOK_ID) return false;
  const r = await call<{ verification_status: string }>(env, "POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  });
  return r.verification_status === "SUCCESS";
}
