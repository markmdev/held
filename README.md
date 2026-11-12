# Held

**Paid the minute the work passes.**

PayPal holds the client's money while a freelancer works. Claude checks the delivered work against the brief both sides agreed, and the freelancer is paid within a minute of passing, with no invoice and no chasing.

**Try it:** https://held.markmorgan-dev.workers.dev

It's for freelancers who sell work with a clear brief (writing, translation, design assets, small web jobs) and for the clients who hire them without knowing them. In the Freelancers Union's survey of 5,358 freelancers, one in two had trouble getting paid in a single year, and the longest wait averaged 98 days. A client who pays up front has the opposite risk: poor work, already paid for.

## What it does

1. The client writes the brief in plain words, with a price and the freelancer's PayPal email.
2. Claude turns the brief into a short list of checks, such as "5 descriptions", "80 to 120 words each", "each says dishwasher-safe". Both sides see them before any money moves.
3. The client approves the payment in PayPal. PayPal places a hold on the money without taking it.
4. The freelancer delivers on the job's page: pasted text, a file (text, PDF, PNG or JPG) or a link. Claude checks the delivery against each check and quotes the line behind each verdict.
5. If every check passes, PayPal captures the hold and pays the freelancer at once. If not, the money stays held and the freelancer sees exactly what's missing. The client can always release the money anyway, release a part, or cancel the hold.

## Results

- Every job run on the live site is in the [ledger](https://held.markmorgan-dev.workers.dev/ledger), with PayPal's sandbox IDs for its hold, capture and payout.
- Median 11.4 seconds from delivery to capture, and 26.9 seconds from delivery to PayPal reporting the payout processed, over the paid jobs in the ledger. The live numbers are at `/api/stats`.
- A test set of 30 brief-and-delivery pairs with an answer key, written on 12 November 2026: 20 of 20 verdicts right on the cases used while tuning the prompts, and 10 of 10 on the cases held back from tuning.
- Ten harder cases, written after the checker was finished and run once: near misses, the wrong subject, a slip in tone only, a PDF, two images, a link and odd layouts. 5 of 10 right. All five wrong verdicts refused good work (a PDF, an image, a link, a table and work with a cover note); none paid for bad work. Every case is on the [results page](https://held.markmorgan-dev.workers.dev/results), the misses first.
- Money released on a failing delivery: 0 times, over all 40 cases.
- Five deliveries contain text telling the checker to pass them: none was paid.

Check each one in the ledger, on the results page, or run the test set yourself (below).

## How it uses PayPal

PayPal's hold is the product's whole mechanism, not a pay button at the end. Take PayPal out and nothing is left.

| What the user does | PayPal call |
|---|---|
| The client approves the hold | PayPal JavaScript SDK buttons with `intent=authorize`, then `POST /v2/checkout/orders` (`intent: AUTHORIZE`) and `POST /v2/checkout/orders/{id}/authorize` |
| The work passes, and the money is taken | `POST /v2/payments/authorizations/{id}/capture` |
| The client releases a part | the same call with a smaller amount and `final_capture: true` |
| The client cancels | `POST /v2/payments/authorizations/{id}/void` |
| The freelancer is paid | `POST /v1/payments/payouts`, then `GET /v1/payments/payouts/{batch_id}` until it succeeds |
| PayPal tells Held what happened | Webhooks for `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.AUTHORIZATION.VOIDED` and `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, verified with `POST /v1/notifications/verify-webhook-signature` |

The code is in [`src/worker/paypal.ts`](src/worker/paypal.ts).

## How it uses AI

Claude does four jobs:

| Job | Model |
|---|---|
| Turns a brief into 3 to 7 checks, each marked "measured" (counted by code) or "judged" | Claude Sonnet 5.5 |
| First check of a delivery, reading images and PDFs too | Claude Sonnet 5.5 |
| Second check, a separate call that doesn't see the first verdict; it runs only when the first passes every check | Claude Opus 5.5 |
| Answers questions about the ledger as AG Studio's agent, and adds a widget with the answer | Claude Sonnet 5.5 |

Four rules hold the verdict before money moves. They're enforced in code ([`src/worker/verdict.ts`](src/worker/verdict.ts)), whatever the model says:

- A pass without a quote from the delivery counts as a fail, unless the check is that something is absent ("no exclamation marks"). A quote from a text delivery must really be in it.
- Counts in text and PDFs are measured by code ([`src/worker/measure.ts`](src/worker/measure.ts)), not by the model, and given to Claude as facts.
- Both checks must pass every item. If they disagree, nothing moves and the client decides.
- Words inside a delivery that try to instruct the checker fail the delivery, and the freelancer is told to take them out.

Every call uses structured output, so a verdict is always one of pass or fail with its quote and reason.

## Technological implementation

The money moves through PayPal's Orders, Payments and Payouts APIs: an authorization holds the client's money, a capture takes all or part of it, a void cancels it, and a payout sends what was taken to the freelancer. Claude turns the brief into checks and checks every delivery twice, with code counting what can be counted and refusing any pass without a quote. The test set runs through the same code the live site uses, with one command.

Built with React, TypeScript and Tailwind CSS, on one Cloudflare Worker (Hono for the API, D1 for the database), with the ledger in AG Studio.

## Design

Both sides share one page per job, from the brief to the payment. Every state of the money (held, paid, part paid, cancelled) is on screen with PayPal's own IDs, and each check shows the words from the delivery behind its verdict. The ledger is an AG Studio dashboard in Held's own theme.

## Potential impact

Freelancers who sell work with a clear brief wait weeks to be paid: in the Freelancers Union's survey, the longest wait averaged 98 days. With Held they're paid seconds after the work passes, and the client never pays for work that misses the brief. It runs on PayPal alone, so there's no marketplace taking a cut.

## Innovation

Escrow services and marketplaces hold money until someone says the job is done. In Held nobody marks the job complete: the brief both sides agreed decides, every verdict quotes its evidence, and the checker is measured against an answer key that anyone can run.

## What's real and what's seeded

Everything was built on 12 November 2026, from an empty repo. Every PayPal call moves sandbox money, every verdict is a live Claude call, and every time shown is measured.

Seeded: the example brief and its two sample deliveries; six finished jobs in the ledger, made by running the real flow on the live site before submitting, so each has real sandbox IDs (four paid, one held after a failed delivery, one cancelled); and the test set of 30.

## Try it

1. Open https://held.markmorgan-dev.workers.dev and press "Try a sample job".
2. Press "Turn the brief into checks", then "Agree the checks and hold $150".
3. On the job's page, press the PayPal button and log in with PayPal's sandbox buyer: `client@held.example.com`, password `HeldJudge2026!` (also printed beside the button).
4. Deliver "A draft that falls short": the money stays held, and you see what's missing.
5. Deliver "The finished work": every check passes, and the freelancer is paid.

It takes under a minute. You can also write your own brief and deliver your own work. The live site allows 200 checks a day, to keep it open to everyone.

## Run it yourself

You need Node.js 22 or later.

```sh
git clone https://github.com/markmdev/held.git
cd held
npm install
cp .dev.vars.example .dev.vars   # then fill in the keys
npm run db:migrate:local
npm run dev                      # http://127.0.0.1:5173
```

The keys in `.dev.vars`:

- `ANTHROPIC_API_KEY`: a Claude API key.
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`: a REST app from the PayPal developer dashboard, in sandbox. The app needs Payouts.
- `PAYPAL_WEBHOOK_ID` (optional): the ID of a webhook on that app pointing at `/api/paypal/webhook`. Without it, Held asks PayPal for the payout's state instead.
- `SANDBOX_BUYER_EMAIL` and `SANDBOX_BUYER_PASSWORD` (optional): a sandbox buyer account, printed beside the PayPal button.

**Run the test set.** It needs only a Claude key:

```sh
ANTHROPIC_API_KEY=... npm run bench              # all 40 cases
ANTHROPIC_API_KEY=... npm run bench -- --tuning  # only the 20 used while tuning
```

It takes about a minute and a half, prints each verdict against the answer key and writes `bench/results.json`, which the results page shows. The cases are in [`bench/cases.json`](bench/cases.json) and [`bench/hard.json`](bench/hard.json), with the harder cases' files in `bench/files`.

`npm test` runs the test of the rule for holds that run out.

**Deploy** to your own Cloudflare account: create a D1 database, put its ID in `wrangler.jsonc`, set the keys with `npx wrangler secret put`, then `npm run db:migrate` and `npm run deploy`.

## Sponsor tool: AG Studio from AG Grid

The [ledger](https://held.markmorgan-dev.workers.dev/ledger) is an AG Studio dashboard in Held's theme: totals for money held and paid, the median time to paid, charts of each job's money, of seconds from delivery to paid, and of verdicts, a grid of every job with PayPal's IDs, and Held's own widget, the proof trail, which shows the selected job's PayPal steps and each check's verdict with its quote. The code is in [`src/client/components/studio.tsx`](src/client/components/studio.tsx).

"Ask about the ledger" opens AG Studio's AI assistant beside the dashboard, at laptop width. Its agents run on Claude through an `AgLlmAdapter` ([`src/client/agent.ts`](src/client/agent.ts)) that sends each turn to Held's worker ([`src/worker/agent.ts`](src/worker/agent.ts)), so the key stays on the server. Ask "Which jobs failed, and why?" and it reads the ledger's data, adds a table of the failed jobs with what each is missing, and answers in words, in under a minute.

## Limits

Sandbox money only. The checker suits work with a clear brief. When the two checks disagree, a person decides. PayPal keeps a hold for 29 days; one that runs out shows as expired, and the money stays with the client.

## Licence

MIT. See [LICENSE](LICENSE).
