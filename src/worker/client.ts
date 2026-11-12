const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

// The client's key is made with the job and handed back once, to the browser that made it. Only its hash is stored.
export async function newClientKey() {
  const key = hex(crypto.getRandomValues(new Uint8Array(32)));
  return { key, hash: await sha256(key) };
}

export async function isClient(hash: string | null, given: string | undefined) {
  return !!hash && !!given && (await sha256(given)) === hash;
}
