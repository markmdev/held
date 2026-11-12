# How Held looks

Read this before changing a screen. A change that departs from it updates it in the same pull request.

## The receipt

Every job is a receipt on a desk. The brief is the contract both sides agreed, each check is a printed line with its verdict and its proof, PayPal's IDs are printed under them, and a rubber stamp on the total says where the money is. The same receipt is the job page, the home page's playback of a real paid job, and the draft beside the new-job form (`src/client/components/receipt.tsx`).

- Paper (`card`) lies on a warm desk (`desk`, also `paper`). The receipt has torn top and bottom edges (`.receipt`); other paper has 4px corners (`--radius-card`). Nothing is a rounded pill.
- Sections of a receipt are split by dashed rules (`.rule`). A check's text runs into its verdict along a dotted leader (`.leader`).
- The stamp (`.stamp`, `<Stamp>`) is the money's state: HELD amber, PAID green, PART PAID green, YOUR CALL violet when the two checks disagree, CANCELLED grey. A job not held yet has no stamp.

## Colour means money

Each state of the money has one colour, used for its stamp, its words and its dot, and nothing else:

| State | Colour | Tokens |
|---|---|---|
| Held by PayPal | amber | `held`, `held-bg`, `held-dot` |
| Paid, part paid, a check passed | green | `paid`, `paid-bg`, `paid-dot` |
| A check failed | red | `fail`, `fail-bg` |
| The two checks disagree: the client decides | violet | `ask`, `ask-bg` |
| Not held yet, cancelled | grey | `off`, `off-bg` |

Everything else is ink on paper: `ink`, `ink-2`, `ink-3` for text, `line` and `line-2` for rules and borders. The tokens are in `src/client/styles.css`; the ledger's theme in `studio.tsx` uses the same ones.

## Type

- Newsreader, a serif, for headings, prose, job titles and the brief (the brief in italic, as the contract).
- IBM Plex Mono for everything printed: receipt lines, money, PayPal's IDs, labels (`.label`), navigation and buttons, in capitals with wide tracking for labels and buttons.
- Each page opens with a mono kicker naming the page and a serif headline asking the question people bring there: "What should be delivered?", "Where's the money?", "Is the checker right?".
- Both fonts are under the open font licence.

## Motion

- Only transform, opacity and clip-path move, under 300 ms, easing out (`--ease-out`). Buttons press in to 0.97.
- Three moments move on purpose: the amber checking strip, with light passing across it while the work is read; a verdict's lines printing one after another (`.print`); and the stamp coming down once the lines are printed (`.stamp-in`, delayed by `--stamp-delay`).
- The home page plays a real paid job back: HELD, then checking, then the lines print and PAID comes down.
- With reduced motion on, nothing slides or prints; things fade, and the home page shows the paid receipt still.

## Words

- Say what the person sees and does: "Release $150 now", "Not yet", "Your call". No internal words such as authorization, capture or outcome on screen; PayPal's own names stay only beside their IDs on the receipt.
- No third-party names or logos on screen besides PayPal's own buttons: say "AI check", not the model's name.
- Held reads as a product in test mode, not a demo: "Test mode", "Sample job", "Try a sample job", "A draft that falls short", "The finished work". Never "demo", "example" or "hackathon".
- A failure says what happened and what to do next, and never looks like an empty page.

## Layout

- Laptop (1440) and phone (390) are both first-class, on one page width (`max-w-7xl`).
- The job page on a laptop: what happened on the left, the receipt in the middle, what each side can do on the right. On a phone: the receipt, then what to do, then what happened; before the money is held, what to do comes first.
- On a phone the stamp gets its own room above the total instead of covering it.
- The ledger is one dashboard: figures, three charts, the table of every job at full width and as tall as its jobs (up to ten, then it scrolls), and under it the proof of the job you pick. Chart axes show the time alone while every job is from one day.
- PayPal draws its own button; style around it, never inside it.
