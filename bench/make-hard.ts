// How the ten harder cases were written (once, on 12 November 2026, after the checker was finished): near misses,
// the wrong subject, a slip in tone only, a PDF, two images, a link, and good work in odd layouts. Claude turns each
// brief into checks as the site does. Claude Opus writes each piece to a word count set here, and this file counts
// the words itself (split on spaces, nothing shared with the checker) before a case is kept. The layouts, the cover
// note, the images' words and the linked page are written by hand below. The PDF and the two images in bench/files
// were made from the HTML files beside them with a headless browser.
import { writeFileSync } from "node:fs";
import { briefToChecks, callJson } from "../src/worker/claude";

const key = process.env.ANTHROPIC_API_KEY!;
const WRITER = "claude-opus-5-5";
const count = (s: string) => s.trim().split(/\s+/).length;

async function piece(task: string, min: number, max: number): Promise<string> {
  let note = "";
  for (let tries = 0; tries < 8; tries++) {
    const out = await callJson<{ text: string }>(
      key,
      WRITER,
      "You write short pieces of realistic freelance work for testing a checker. Output only the piece itself in the text field, as one paragraph with no line breaks and no heading unless asked.",
      [{ type: "text", text: `${task}\n\nLength: ${min === max ? `exactly ${min}` : `${min} to ${max}`} words, counting every word separated by spaces.${note}` }],
      { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
    );
    const text = out.text.trim().replace(/\s*\n+\s*/g, " ");
    const n = count(text);
    if (n >= min && n <= max) return text;
    note = `\n\nYour last attempt had ${n} words: "${text}". Rewrite it to the asked length.`;
  }
  throw new Error(`couldn't reach ${min}-${max} words: ${task.slice(0, 60)}`);
}

const BRUNCH = "Write four menu descriptions for our cafe's brunch: Shakshuka, Ricotta Pancakes, Smoked Trout Toast and Granola Bowl. 25 to 40 words each. Each must name one allergen it contains.";
const PACKS = "Write three product descriptions for our hiking backpacks: the Ridge 30, the Summit 45 and the Trail 20. 50 to 70 words each. Each must give the pack's volume in litres.";
const EMAIL = "Write a welcome email for new members of our climbing gym. 90 to 130 words. Mention the free intro class on Mondays at 6 pm. Warm and encouraging in tone; nothing that talks down to beginners.";
const POLICY = "Write a one-page returns policy for our online shoe shop, as a PDF. It must have four sections with these headings: Time limit, Condition, How to return, Refunds. State the 30-day limit. Under 250 words in total.";
const IMAGE = "Design a square social image announcing our bakery's opening. It must show the name 'Crumb & Co', the words 'Opening Saturday 9 am', and the address '14 Mill Lane'. No other text.";
const SITE = "Build a one-page site for our yoga studio and send the link. The headline must say 'Your first class is free'. List three class types: Hatha, Vinyasa and Yin. Include the contact email hello@stillwater.example.";
const FAQ = "Write five FAQ answers for our bike rental shop: opening hours, deposit, helmets, late returns and child seats. 20 to 40 words per answer.";

const dish = (name: string, min: number, max: number) =>
  piece(`A menu description for a cafe's brunch dish, ${name}. Start the paragraph with the dish's name as part of the first sentence. Name one allergen it contains (for example eggs, milk, gluten, fish or nuts).`, min, max);
const pack = (name: string, litres: number) =>
  piece(`A product description for a hiking backpack called the ${name}. Say that it holds ${litres} litres. Start with the pack's name.`, 55, 65);
const cooler = (name: string, litres: number) =>
  piece(`A product description for a hard-sided picnic cool box (for food and drinks, not something you wear or carry on your back) called the ${name}. Say that it holds ${litres} litres. Start with the cool box's name. Don't use the words backpack, pack, hike or hiking.`, 55, 65);

async function build() {
  const [brunchOver, brunchExact, coolers, packs, email, policy, faq] = await Promise.all([
    Promise.all([dish("Shakshuka", 28, 36), dish("Ricotta Pancakes", 41, 41), dish("Smoked Trout Toast", 28, 36), dish("Granola Bowl", 28, 36)]),
    Promise.all([dish("Shakshuka", 40, 40), dish("Ricotta Pancakes", 25, 25), dish("Smoked Trout Toast", 28, 36), dish("Granola Bowl", 28, 36)]),
    Promise.all([cooler("Ridge 30", 30), cooler("Summit 45", 45), cooler("Trail 20", 20)]),
    Promise.all([pack("Ridge 30", 30), pack("Summit 45", 45), pack("Trail 20", 20)]),
    piece(
      "A welcome email for new members of a climbing gym. It mentions the free intro class on Mondays at 6 pm. Everything is right except the tone: in two or three places it talks down to beginners (for example, saying nobody expects much from them, or that even they can manage the easy wall). Keep it otherwise friendly, so the slip is in tone only. Start with 'Hi there,' and end with a sign-off from 'The Granite Room team'.",
      100,
      120,
    ),
    Promise.all([
      piece("The 'Time limit' section of an online shoe shop's returns policy. Say that returns are accepted within 30 days of delivery. No heading.", 30, 45),
      piece("The 'Condition' section of an online shoe shop's returns policy: unworn, in the original box. No heading.", 30, 45),
      piece("The 'How to return' section of an online shoe shop's returns policy: print the label from your account, drop the parcel at a pickup point. No heading.", 30, 45),
      piece("The 'Refunds' section of an online shoe shop's returns policy: refunded to the original payment method within 5 working days of the parcel arriving. No heading.", 30, 45),
    ]),
    Promise.all(
      ["opening hours (9 am to 6 pm every day)", "the deposit (50 euros, returned with the bike)", "helmets (free with every rental)", "late returns (10 euros per hour)", "child seats (book a day ahead)"].map((t) =>
        piece(`An FAQ answer for a bike rental shop about ${t}. Don't use the character | anywhere.`, 24, 34),
      ),
    ),
  ]);

  const headings = ["Time limit", "Condition", "How to return", "Refunds"];
  const questions = ["When are you open?", "How much is the deposit?", "Do I get a helmet?", "What if I'm late?", "Do you have child seats?"];
  const packNames = ["Ridge 30", "Summit 45", "Trail 20"];
  const titled = (names: string[], bodies: string[]) => names.map((n, i) => `${n}\n${bodies[i]}`).join("\n\n");

  writeFileSync(
    new URL("./files/returns-policy.html", import.meta.url),
    `<!doctype html><meta charset="utf-8"><body style="font: 15px/1.5 Georgia, serif; width: 560px; margin: 40px"><h1 style="font-size: 26px">Returns policy</h1>${headings.map((h, i) => `<h2 style="font-size: 18px; margin: 28px 0 6px">${h}</h2><p style="margin: 0">${policy[i]}</p>`).join("")}</body>\n`,
  );
  const poster = (day: string) =>
    `<!doctype html><meta charset="utf-8"><body style="margin: 0; width: 1080px; height: 1080px; background: #f4e9d8; color: #3b2314; font-family: Georgia, serif; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center"><div style="font-size: 132px; font-weight: bold">Crumb &amp; Co</div><div style="font-size: 72px; margin-top: 72px">Opening ${day} 9 am</div><div style="font-size: 48px; margin-top: 56px">14 Mill Lane</div></body>\n`;
  writeFileSync(new URL("./files/bakery-opening.html", import.meta.url), poster("Saturday"));
  writeFileSync(new URL("./files/bakery-opening-sunday.html", import.meta.url), poster("Sunday"));

  const specs: { id: string; brief: string; expected: "pass" | "fail"; why: string; delivery?: string; file?: { name: string; type: string }; link?: string }[] = [
    { id: "brunch-one-word-over", brief: BRUNCH, expected: "fail", why: `One description is 41 words, one over the limit (counts: ${brunchOver.map(count).join(", ")})`, delivery: brunchOver.join("\n\n") },
    { id: "brunch-at-the-limits", brief: BRUNCH, expected: "pass", why: `Descriptions of exactly 40 and exactly 25 words, on the limits (counts: ${brunchExact.map(count).join(", ")})`, delivery: brunchExact.join("\n\n") },
    { id: "packs-wrong-product", brief: PACKS, expected: "fail", why: "Right names, right lengths and litres, but the descriptions are of cool boxes, not hiking backpacks", delivery: titled(packNames, coolers) },
    { id: "packs-with-cover-note", brief: PACKS, expected: "pass", why: "Good work wrapped in a cover note and a sign-off, which aren't descriptions", delivery: `Hi Sam,\n\nHere are the three backpack descriptions we agreed. I kept each one close to sixty words and put the volume near the start, since that's what people search for. Happy to adjust anything.\n\n${titled(packNames, packs)}\n\nThanks again for the work. The invoice goes through Held, so there's nothing to send.\n\nBest,\nMaya` },
    { id: "welcome-tone-only", brief: EMAIL, expected: "fail", why: "Right length and the class is mentioned; the only slip is that it talks down to beginners", delivery: email },
    { id: "returns-policy-pdf", brief: POLICY, expected: "pass", why: "Good work delivered as a PDF", file: { name: "returns-policy.pdf", type: "application/pdf" } },
    { id: "bakery-image", brief: IMAGE, expected: "pass", why: "Good work delivered as an image", file: { name: "bakery-opening.png", type: "image/png" } },
    { id: "bakery-image-wrong-day", brief: IMAGE, expected: "fail", why: "An image that says Sunday where the brief says Saturday", file: { name: "bakery-opening-sunday.png", type: "image/png" } },
    { id: "yoga-site-link", brief: SITE, expected: "pass", why: "Good work delivered as a link to a live page", link: "https://held.markmorgan-dev.workers.dev/samples/stillwater-yoga" },
    { id: "faq-as-a-table", brief: FAQ, expected: "pass", why: `Good work laid out as a table, one row per answer (counts: ${faq.map(count).join(", ")})`, delivery: `| Question | Answer |\n|---|---|\n${questions.map((q, i) => `| ${q} | ${faq[i]} |`).join("\n")}` },
  ];

  const checks = new Map<string, Awaited<ReturnType<typeof briefToChecks>>["checks"]>();
  for (const b of new Set(specs.map((s) => s.brief))) checks.set(b, (await briefToChecks(key, b)).checks);
  const cases = specs.map((s) => ({ ...s, checks: checks.get(s.brief)!, heldOut: false, injection: false }));
  writeFileSync(new URL("./hard.json", import.meta.url), JSON.stringify(cases, null, 1) + "\n");
  console.log(cases.length, "harder cases written");
  for (const c of cases) console.log(c.id, c.expected, "|", c.why);
}

await build();
