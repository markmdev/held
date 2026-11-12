import { words } from "./measure";
import { pdfText } from "./pdf";

export type Incoming = { text?: string; link?: string; file?: { name: string; type: string; base64: string } };

// A delivery as the checker gets it: its text where it has any, what Claude reads, and `form`, the facts code
// measured about the delivery as a whole (how it came, its size, its length). A check about the form of the
// work, such as "a one-page PDF" or "a square image", is decided on those facts.
export type Read = { label: string; text: string | null; blocks: Record<string, unknown>[]; form: string[] };

const bytesOf = (base64: string) => Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
const total = (text: string) => `Words in total: ${words(text)}.`;

// Width and height from a PNG's header or a JPEG's frame header; null when the bytes aren't that.
export function imageSize(b: Uint8Array, type: string): { width: number; height: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  if (type === "image/png") {
    if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
    return { width: (u16(16) << 16) | u16(18), height: (u16(20) << 16) | u16(22) };
  }
  if (type === "image/jpeg") {
    if (b[0] !== 0xff || b[1] !== 0xd8) return null;
    // Segments follow, each FF, a marker and a length; the frame header (SOF0 to SOF15, bar DHT, JPG and DAC) has the size.
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: u16(i + 7), height: u16(i + 5) };
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

export async function readDelivery(d: Incoming): Promise<Read> {
  if (d.text?.trim()) {
    const text = d.text.slice(0, 60000);
    return { label: "Pasted text", text, blocks: [{ type: "text", text }], form: ["Delivered as pasted text.", total(text)] };
  }
  if (d.file?.base64) {
    const { name, type, base64 } = d.file;
    if (base64.length > 7_000_000) throw new Error("bad: The file is over 5 MB.");
    if (type === "application/pdf") {
      const { text, pages } = await pdfText(bytesOf(base64));
      return {
        label: name, text, blocks: [{ type: "document", source: { type: "base64", media_type: type, data: base64 } }],
        form: [`Delivered as a file: ${name} (PDF, ${pages} ${pages === 1 ? "page" : "pages"}).`, ...(text ? [total(text)] : [])],
      };
    }
    if (/^image\/(png|jpeg|gif|webp)$/.test(type)) {
      const size = imageSize(bytesOf(base64), type);
      const shape = size && (size.width === size.height ? "square" : size.width > size.height ? "landscape" : "portrait");
      return {
        label: name, text: null, blocks: [{ type: "image", source: { type: "base64", media_type: type, data: base64 } }],
        form: [`Delivered as a file: ${name} (${type.slice(6).toUpperCase()} image).`, ...(size ? [`Image size: ${size.width} × ${size.height} pixels (${shape}).`] : [])],
      };
    }
    if (type.startsWith("text/") || /\.(txt|md|csv|html?)$/i.test(name)) {
      const text = new TextDecoder().decode(bytesOf(base64)).slice(0, 60000);
      return { label: name, text, blocks: [{ type: "text", text }], form: [`Delivered as a file: ${name} (text).`, total(text)] };
    }
    throw new Error("bad: Deliver text, a PDF, or a PNG or JPG image.");
  }
  if (d.link && /^https?:\/\//.test(d.link)) {
    const res = await fetch(d.link, { headers: { "user-agent": "HeldChecker/1.0" }, redirect: "follow" }).catch(() => null);
    if (!res?.ok) throw new Error("bad: The link didn't load.");
    const html = (await res.text()).slice(0, 400000);
    const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim().slice(0, 60000);
    const link = d.link.slice(0, 200);
    return { label: link, text, blocks: [{ type: "text", text }], form: [`Delivered as a link: ${link}`, `The link loaded when it was checked (HTTP ${res.status}).`, total(text)] };
  }
  throw new Error("bad: Paste the work, attach a file, or give a link.");
}
