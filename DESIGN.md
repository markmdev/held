# How Held looks

Read this before changing a screen. A change that departs from it updates it in the same pull request.

## Colour means money

Each state of the money has one colour, used for its pill, its dot and its box, and nothing else:

| State | Colour | Tokens |
|---|---|---|
| Held by PayPal | amber | `held`, `held-bg`, `held-dot` |
| Paid, part paid, a check passed | green | `paid`, `paid-bg`, `paid-dot` |
| A check failed | red | `fail`, `fail-bg` |
| The two checks disagree: the client decides | violet | `ask`, `ask-bg` |
| Not held yet, cancelled | grey | `off`, `off-bg` |

Everything else is ink on paper: `ink`, `ink-2`, `ink-3` for text, `line` and `line-2` for borders, `paper` for the page and `card` for cards. The tokens are in `src/client/styles.css`.

## Type and shapes

- IBM Plex Sans for words, Plex Mono for PayPal's IDs and Plex Serif for a delivery's own text, all under the open font licence, with tabular numbers.
- The amount is the hero of a job: one big number in its state's colour, the state in words beside it.
- PayPal's IDs are always mono pills with a copy button that turns to a tick: they are the proof that money moved.
- Cards have an 18px radius and a hairline shadow (`.card`). Buttons are 44px tall (`.btn`, `.btn-quiet`, `.btn-danger`), fields use `.field`, small capitals labels use `.label`.
- The name mark is an amber coin held between two bars: the client's money, between the two sides, until the work passes.

## Motion

- Only transform and opacity move, under 300 ms, easing out (`--ease-out`). Buttons press in to 0.97.
- Two moments move on purpose: the amber checking panel, with light passing across it while the work is read, and a verdict's rows rising in one after another when it lands.
- With reduced motion on, nothing slides; things fade.

## Words

- Say what the person sees and does: "Release $150 now", "Not yet", "Checks disagree". No internal words such as authorization, capture or outcome on screen; PayPal's own names stay only beside their IDs.
- No third-party names or logos on screen besides PayPal's own buttons: say "AI check", not the model's name.
- Held reads as a product in test mode, not a demo: "Test mode", "Sample job", "Try a sample job", "A draft that falls short", "The finished work". Never "demo", "example" or "hackathon".
- A failure says what happened and what to do next, and never looks like an empty page.

## Layout

- Laptop (1440) and phone (390) are both first-class. On the job page, a phone shows the money, then the checks, then what the person can do, then the deliveries.
- PayPal draws its own button; style around it, never inside it.
