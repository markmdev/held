import type { Measure } from "../shared/types";

const MARKER = /^\s*(?:\d+[.)]|[-*•])\s+/;

const ROW = /^\s*\|.*\|\s*$/;
const cells = (row: string) => row.trim().slice(1, -1).split("|").map((c) => c.trim());

// A delivery's pieces: a table's rows, numbered or bulleted blocks if it has them, otherwise blank-line paragraphs.
// A short lead-in line ending in a colon ("Here are the five descriptions:") isn't a piece.
export function splitItems(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let items: string[];
  const rows = lines.filter((l) => ROW.test(l));
  if (rows.length >= 2) {
    // The row above a |---|---| line names the columns; every other row is a piece.
    const rule = rows.findIndex((r) => cells(r).every((c) => /^:?-+:?$/.test(c)));
    items = rows.filter((_, i) => i !== rule && (rule < 0 || i !== rule - 1)).map((r) => cells(r).join(" "));
  } else if (lines.filter((l) => MARKER.test(l)).length >= 2) {
    items = [];
    for (const line of lines) {
      if (MARKER.test(line)) items.push(line.replace(MARKER, ""));
      else if (items.length && line.trim()) items[items.length - 1] += " " + line.trim();
    }
  } else {
    // A short line on its own, such as a product name or a heading, belongs to the paragraph under it.
    // A line ending in a comma is a greeting or a sign-off ("Hi Sam,"), not a title.
    items = [];
    const titled: boolean[] = [];
    let title = "";
    for (const block of text.split(/\n\s*\n/)) {
      const b = block.trim();
      if (!b) continue;
      const [first, ...rest] = b.split("\n");
      const heads = (line: string) => words(line) <= 6 && !/[.!?:,]["”’)]?$/.test(line.trim());
      if (!rest.length && heads(b)) {
        title = title ? `${title} ${b}` : b;
        continue;
      }
      titled.push(!!title || heads(first));
      items.push(title ? `${title.replace(/^#+\s*|\*\*/g, "")} ${b}` : b);
      title = "";
    }
    if (title) items.push(title);
    // When the pieces each have a title, what comes before the first and after the last (a cover note,
    // a thank-you, a sign-off) is the freelancer talking, not the work.
    if (titled.filter(Boolean).length >= 2) items = items.slice(titled.indexOf(true), titled.lastIndexOf(true) + 1);
    // A plain list, one short line per item with no blank lines between, is one item per line.
    if (items.length === 1) {
      const lines = items[0].split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 3 && lines.every((l) => words(l) <= 12)) items = lines;
    }
  }
  return items.map((s) => s.trim()).filter((s) => s && !(words(s) <= 10 && /:\s*$/.test(s)));
}

export function words(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

const fold = (s: string) => s.toLowerCase().replace(/[‐-―-]/g, "-").replace(/\s+/g, " ");
const has = (text: string, phrase: string) => fold(text).includes(fold(phrase)) || fold(text).includes(fold(phrase).replace(/-/g, " "));
const start = (s: string, n = 12) => s.split(/\s+/).slice(0, n).join(" ");

export type Measured = { pass: boolean; fact: string; quote: string };

export function measure(m: Measure, text: string): Measured {
  const items = splitItems(text);
  switch (m.type) {
    case "item_count": {
      const n = items.length;
      return { pass: n >= m.min && n <= m.max, fact: `${n} ${n === 1 ? "piece" : "pieces"} found; needs ${range(m.min, m.max)}`, quote: items.map((s, i) => `${i + 1}. ${start(s, 6)}…`).join(" ") };
    }
    case "words_per_item": {
      const counts = items.map(words);
      const off = items.map((s, i) => ({ s, i, n: counts[i] })).filter(({ n }) => n < m.min || n > m.max);
      const fact = `word counts: ${counts.join(", ")}; each needs ${range(m.min, m.max)}`;
      return off.length
        ? { pass: false, fact, quote: off.map(({ s, i, n }) => `Piece ${i + 1} (${n} words): “${start(s)}…”`).join(" ") }
        : { pass: items.length > 0, fact, quote: items.length ? `Piece 1 (${counts[0]} words): “${start(items[0])}…”` : "" };
    }
    case "total_words": {
      const n = words(text);
      return { pass: n >= m.min && n <= m.max, fact: `${n} words in total; needs ${range(m.min, m.max)}`, quote: `“${start(text)}…”` };
    }
    case "each_item_contains": {
      const missing = items.map((s, i) => ({ s, i })).filter(({ s }) => !has(s, m.phrase));
      const fact = `“${m.phrase}” appears in ${items.length - missing.length} of ${items.length} pieces`;
      if (missing.length) return { pass: false, fact, quote: missing.map(({ s, i }) => `Piece ${i + 1}: “${start(s)}…”`).join(" ") };
      const hit = sentenceWith(items[0] ?? "", m.phrase);
      return { pass: items.length > 0, fact, quote: hit };
    }
    case "none_contains": {
      const hits = items.flatMap((s, i) => (has(s, m.phrase) ? [`Piece ${i + 1}: “${sentenceWith(s, m.phrase)}”`] : []));
      return { pass: hits.length === 0, fact: `“${m.phrase}” appears in ${hits.length} ${hits.length === 1 ? "piece" : "pieces"}`, quote: hits.join(" ") || "none found" };
    }
  }
}

function range(min: number, max: number) {
  return min === max ? `${min}` : max >= 1e6 ? `at least ${min}` : `${min} to ${max}`;
}

function sentenceWith(text: string, phrase: string): string {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return (sentences.find((s) => has(s, phrase)) ?? sentences[0]).trim();
}
