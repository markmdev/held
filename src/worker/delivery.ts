import { pdfText } from "./pdf";

export type Incoming = { text?: string; link?: string; file?: { name: string; type: string; base64: string } };

export async function readDelivery(d: Incoming): Promise<{ label: string; text: string | null; blocks: Record<string, unknown>[] }> {
  if (d.text?.trim()) return { label: "Pasted text", text: d.text.slice(0, 60000), blocks: [{ type: "text", text: d.text.slice(0, 60000) }] };
  if (d.file?.base64) {
    const { name, type, base64 } = d.file;
    if (base64.length > 7_000_000) throw new Error("bad: The file is over 5 MB.");
    if (type === "application/pdf") return { label: name, text: await pdfText(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))), blocks: [{ type: "document", source: { type: "base64", media_type: type, data: base64 } }] };
    if (/^image\/(png|jpeg|gif|webp)$/.test(type)) return { label: name, text: null, blocks: [{ type: "image", source: { type: "base64", media_type: type, data: base64 } }] };
    if (type.startsWith("text/") || /\.(txt|md|csv|html?)$/i.test(name)) {
      const text = new TextDecoder().decode(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))).slice(0, 60000);
      return { label: name, text, blocks: [{ type: "text", text }] };
    }
    throw new Error("bad: Deliver text, a PDF, or a PNG or JPG image.");
  }
  if (d.link && /^https?:\/\//.test(d.link)) {
    const res = await fetch(d.link, { headers: { "user-agent": "HeldChecker/1.0" }, redirect: "follow" }).catch(() => null);
    if (!res?.ok) throw new Error("bad: The link didn't load.");
    const html = (await res.text()).slice(0, 400000);
    const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim().slice(0, 60000);
    return { label: d.link.slice(0, 200), text, blocks: [{ type: "text", text }] };
  }
  throw new Error("bad: Paste the work, attach a file, or give a link.");
}
