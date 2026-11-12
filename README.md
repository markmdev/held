# Held

**Paid the minute the work passes.**

**Try it:** https://heldpayments.com

Freelancers wait weeks because payment waits for the client to say "done". In Held, nobody has to say it. PayPal holds the client's money while the freelancer works, Claude checks the delivered work against the brief both sides agreed, and the freelancer is paid within a minute of passing, with no invoice and no chasing.

It's for freelancers who sell work with a clear brief (writing, translation, design assets, small web jobs) and for the clients who hire them without knowing them. In the Freelancers Union's 2015 survey of 5,358 freelancers ([the report](https://www.onlabor.org/wp-content/uploads/2017/05/FU_NonpaymentReport_r3.pdf)), one in two had trouble getting paid in 2014, and the longest wait averaged 98 days. A client who pays up front has the opposite risk: poor work, already paid for.

## What it does

1. The client writes the brief in plain words, with a price and the freelancer's PayPal email.
2. Claude turns the brief into a short list of checks, such as "5 descriptions", "80 to 120 words each", "each says dishwasher-safe". Both sides see them before any money moves.
3. The client approves the payment in PayPal. PayPal places a hold on the money without taking it.
4. The freelancer delivers on the job's page: pasted text, a file (text, PDF, PNG or JPG) or a link. Claude checks the delivery against each check and quotes the line behind each verdict.
5. If every check passes, PayPal captures the hold and pays the freelancer at once. If not, the money stays held and the freelancer sees exactly what's missing. The client can always release the money anyway, release a part, or cancel the hold. The freelancer has the same link but not those buttons.

## Results

- Every job run on the live site is in the [ledger](https://heldpayments.com/ledger), with PayPal's sandbox IDs for its hold, capture and payout.
- At submission the ledger holds seven jobs, five of them paid. The seventh is the job paid in the video.
- Median 11.6 seconds from delivery to capture, and 27.0 seconds from delivery to PayPal reporting the payout processed, over those five paid jobs. Every run on the live site adds to them; the live numbers are at `/api/stats`.
- 35 of 40 verdicts right on the first run of a test set with an answer key, written on 12 November 2026: 20 of 20 on the cases used while tuning the prompts, 10 of 10 on the cases held back from tuning, and 5 of 10 on ten harder cases written after the checker was finished (near misses, the wrong subject, a slip in tone only, a PDF, two images, a link and odd layouts).
- All five wrong verdicts refused good work (a PDF, an image, a link, a table and work with a cover note); none paid for bad work. Each miss showed a real fault, and the [results page](https://heldpayments.com/results) gives each one's cause and fix. With those fixes, `npm run bench` gets all 40 right today: it prints 20 of 20, 10 of 10 and 10 of 10. The harder cases' first-run verdicts are kept in [`bench/hard-first-run.json`](bench/hard-first-run.json).
- Money released on a failing delivery: 0 times, over all 40 cases.
- Five deliveries contain text telling the checker to pass them: none was paid.

Check each one in the ledger, on the results page, or run the test set yourself (below).

## How it uses PayPal

PayPal's hold is the product's whole mechanism, not a pay button at the end. No person presses pay: when both checks pass, Held calls PayPal's capture and payout itself, and a failed check leaves the hold where it is. Take PayPal out and nothing is left.

| What the user does | PayPal call |
|---|---|
| The client approves the hold | PayPal JavaScript SDK buttons with `intent=authorize`, then `POST /v2/checkout/orders` (`intent: AUTHORIZE`) and `POST /v2/checkout/orders/{id}/authorize` |
| The work passes, and the money is taken | `POST /v2/payments/authorizations/{id}/capture` |
| The client releases a part | the same call with a smaller amount and `final_capture: true` |
| The client cancels | `POST /v2/payments/authorizations/{id}/void` |
| The freelancer is paid | `POST /v1/payments/payouts`, then `GET /v1/payments/payouts/{batch_id}` until it succeeds |
| PayPal tells Held what happened | Webhooks, each checked with `POST /v1/notifications/verify-webhook-signature` before it's believed, and each recorded. `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` marks the payout done, `PAYMENT.AUTHORIZATION.VOIDED` marks the hold cancelled, and `PAYMENT.CAPTURE.COMPLETED` is recorded. |

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

- A pass without a quote counts as a fail, unless the check is that something is absent ("no exclamation marks"). The quote must really be in the delivery, or be one of the facts code measured about it (its kind, its pages, an image's size, that a link loaded, its words in total).
- Counts in text, PDFs and linked pages are measured by code ([`src/worker/measure.ts`](src/worker/measure.ts)), not by the model, and given to Claude as facts.
- Both checks must pass every item. If they disagree, nothing moves and the client decides.
- Words inside a delivery that try to instruct the checker fail the delivery, and the freelancer is told to take them out.

Every call uses structured output, so a verdict is always one of pass or fail with its quote and reason.

**An agent that moves money, inside hard limits.** When the work passes, no person presses pay: the checker decides, and PayPal takes and sends the money on its word. It can only act inside rules written in code: the amount both sides agreed, a quote behind every pass (from the work, or a fact code measured about it; only a check that something is absent needs none), a second model that must agree, and one capture per hold.

## Technological Implementation

The money moves through PayPal's Orders, Payments and Payouts APIs: an authorization holds the client's money, a capture takes all or part of it, a void cancels it, and a payout sends what was taken to the freelancer. Claude turns the brief into checks and checks every delivery twice, with code counting what can be counted and refusing any pass without a quote. The test set of 40 cases runs through the same code the live site uses, with one command, and the faults its harder cases found are fixed with their tests in the repo. Only the client can release or cancel by hand: the job's maker gets a key that stays in their browser, and the server keeps only its hash.

Built with React, TypeScript and Tailwind CSS, on one Cloudflare Worker (Hono for the API, D1 for the database), with the ledger in AG Studio.

## Design

Both sides share one page per job, from the brief to the payment, and each sees their own side: the buttons that release or cancel the money appear only for the client. Every state of the money (held, paid, part paid, cancelled) is on screen with PayPal's own IDs, and each check shows the words from the delivery behind its verdict. The ledger is an AG Studio dashboard in Held's own theme.

## Potential Impact

Freelancers wait because payment waits for the client to say the work is done, and that sign-off is where the weeks go. Half of the 5,358 freelancers in the Freelancers Union's 2015 survey had trouble getting paid in 2014, losing $5,968 on average that year, and the longest wait averaged 98 days. Held takes the sign-off away: both sides agree what "done" means before the money is set aside, the freelancer is paid seconds after the work passes, and the client never pays for work that misses the brief. A client who means to pay gives nothing up by holding: the money isn't taken until the work passes, and it stays theirs if they cancel or the hold runs out. It runs on PayPal alone, so there's no marketplace taking a cut on top of PayPal's usual fees.

## Innovation/Idea

Escrow services and marketplaces hold money until a person says the job is done, and AI reviewers give an opinion that a person then acts on. In Held the checks are agreed before the money is held, and the verdict itself moves the money. That is only safe because the model can't pay on its own word: code counts what can be counted, a pass needs a quote that is really in the work or a fact code measured about it, a second model must agree, and any doubt leaves the money held for the client to decide. The checker is then measured against an answer key that anyone can run, with its misses shown.

## Presentation

The video shows one real run on the live site, from the brief to the freelancer being paid, then the ledger and the test results. Everything in it can be repeated at https://heldpayments.com in about two minutes.

## What's real and what's seeded

Everything was built on 12 November 2026, from an empty repo. Every PayPal call moves sandbox money, every verdict is a live Claude call, and every time shown is measured.

Seeded: the example brief and its two sample deliveries; six finished jobs in the ledger, made by running the real flow on the live site before submitting, so each has real sandbox IDs (four paid, one held after a failed delivery, one cancelled); and the test set of 40. The seventh job in the ledger is the run filmed for the video. The six seeded jobs are locked: nobody can deliver on them or move their money.

## Try it

1. Open https://heldpayments.com and press "Try a sample job".
2. Press "Turn the brief into checks", then "Agree the checks and hold $150".
3. On the job's page, press the PayPal button and log in with PayPal's sandbox buyer: `client@held.example.com`, password `HeldJudge2026!` (also printed beside the button).
4. Deliver "A draft that falls short": the money stays held, and you see what's missing.
5. Deliver "The finished work": every check passes, and the freelancer is paid.

To see the freelancer's side, open the job's link in a private window while the money is held (after step 3 or 4): the same page, without the client's buttons.

It takes about two minutes, most of it PayPal's login. You can also write your own brief and deliver your own work. The live site allows 200 checks a day, to keep it open to everyone.

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

`npm test` runs the tests of the rules that money rests on: the piece counter on the layouts it once got wrong, reading an image's size, a pass resting on a measured fact, holds that run out, and the client's key.

**Deploy** to your own Cloudflare account: create a D1 database, put its ID in `wrangler.jsonc`, set the keys with `npx wrangler secret put`, then `npm run db:migrate` and `npm run deploy`.

## Sponsor tool: AG Studio from AG Grid

The [ledger](https://heldpayments.com/ledger) is an AG Studio dashboard in Held's theme: totals for money held and paid, the median time to paid, charts of each job's money, of seconds from delivery to paid, and of verdicts, a grid of every job with PayPal's IDs, and Held's own widget, the proof trail, which shows the selected job's PayPal steps and each check's verdict with its quote. The code is in [`src/client/components/studio.tsx`](src/client/components/studio.tsx).

"Ask about the ledger" opens AG Studio's AI assistant beside the dashboard, at laptop width. Its agents run on Claude through an `AgLlmAdapter` ([`src/client/agent.ts`](src/client/agent.ts)) that sends each turn to Held's worker ([`src/worker/agent.ts`](src/worker/agent.ts)), so the key stays on the server. Ask "Which jobs failed, and why?" and it reads the ledger's data, adds a table of the failed jobs with what each is missing, and answers in words, in about a minute.

## Limits

Sandbox money only. On live PayPal, PayPal's usual fees apply. The checker suits work with a clear brief. Good work in a form the checker hasn't seen may still be refused, which only holds the money for the client to release. When the two checks disagree, a person decides. PayPal keeps a hold for 29 days; one that runs out shows as expired, and the money stays with the client. PayPal only promises a hold's money for its first 3 days; after that a capture can be declined, and Held doesn't renew the hold yet. There are no accounts yet: the client is whoever made the job, in that browser, so a live version needs both sides to sign in.

## Licence

MIT. See [LICENSE](LICENSE).
