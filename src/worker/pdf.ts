// A PDF's text with its paragraphs kept, so code can count pieces and check quotes the same as pasted text.
// PDFs have no blank lines: a paragraph shows only as a wider gap between lines, so a gap well above the
// usual line spacing becomes a blank line. A word split at a hyphen across lines is joined again.
export async function pdfText(bytes: Uint8Array): Promise<string | null> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const lines: { text: string; y: number; page: number }[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    let text = "";
    let y = NaN;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      if (Number.isNaN(y)) y = item.transform[5];
      text += item.str;
      if (item.hasEOL) {
        lines.push({ text, y, page: n });
        text = "";
        y = NaN;
      }
    }
    if (text.trim()) lines.push({ text, y: Number.isNaN(y) ? 0 : y, page: n });
  }
  const gaps = lines.slice(1).map((l, i) => (l.page === lines[i].page ? lines[i].y - l.y : null)).filter((g): g is number => g !== null && g > 0);
  const usual = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0;
  let out = "";
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    if (prev) {
      const gap = prev.page === l.page ? prev.y - l.y : 0;
      out += prev.text.endsWith("-") ? "" : usual && gap > usual * 1.4 ? "\n\n" : "\n";
    }
    out += l.text.trim() === "" ? "" : l.text;
  });
  const text = out.replace(/\n{3,}/g, "\n\n").trim();
  return text ? text.slice(0, 60000) : null;
}
