// One turn of AG Studio's ledger agent, run on Claude: AG Studio's request in, its response out.
// The client never sees the key; Studio's own agents decide what to ask and which of its tools to call.
import type { AgAiConversationItem, AgAiOutputItem, AgLlmRequest, AgLlmResponse } from "ag-studio";

export const AGENT_MODEL = "claude-sonnet-5-5";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };
type Message = { role: "user" | "assistant"; content: Block[] };

function args(s: string) {
  try {
    const v = JSON.parse(s || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// Claude needs alternating turns, with each tool result straight after its call.
function messages(input: AgAiConversationItem[]) {
  const out: Message[] = [];
  const system: string[] = [];
  const answered = new Set(input.filter((i) => i.type === "function_call_output").map((i) => i.callId));
  const push = (role: Message["role"], block: Block) => {
    const last = out.at(-1);
    if (last?.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };
  for (const item of input) {
    if (item.type === "message" && item.role === "system") system.push(item.content.map((c) => (c.type === "text" ? c.text : "")).join("\n"));
    else if (item.type === "message" && item.role === "user") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : "")).join("\n").trim();
      if (text) push("user", { type: "text", text });
    } else if (item.type === "message" && item.role === "assistant") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("\n").trim();
      if (text) push("assistant", { type: "text", text });
    } else if (item.type === "function_call") {
      push("assistant", { type: "tool_use", id: item.callId, name: item.name, input: args(item.arguments) });
      if (!answered.has(item.callId) && item.result !== undefined) push("user", { type: "tool_result", tool_use_id: item.callId, content: item.result });
    } else if (item.type === "function_call_output") push("user", { type: "tool_result", tool_use_id: item.callId, content: item.output });
  }
  return { messages: out, system };
}

// Studio's agents send the same instructions, tools and history again on every turn of a run, so Claude
// reads them from its prompt cache: the tools first, then everything up to the newest message.
const cache = { cache_control: { type: "ephemeral" } };
function cachedTools<T extends object>(tools: T[]) {
  return tools.map((t, i) => (i === tools.length - 1 ? { ...t, ...cache } : t));
}
function cached(msgs: Message[]) {
  const last = msgs.at(-1);
  if (!last) return msgs;
  return [...msgs.slice(0, -1), { ...last, content: last.content.map((b, i) => (i === last.content.length - 1 ? { ...b, ...cache } : b)) }];
}

export async function agentTurn(key: string, req: AgLlmRequest): Promise<AgLlmResponse> {
  const { messages: msgs, system } = messages(req.input);
  if (req.instructions) system.unshift(req.instructions);
  // Claude Sonnet 5.5 takes no forced tool choice, so a required call is asked for in words.
  const choice = req.toolChoice;
  if (choice === "required") system.push("Call one of your tools now.");
  else if (choice && typeof choice === "object") system.push(`Call the ${choice.name} tool now.`);
  if (req.responseFormat?.type === "json")
    system.push(`Answer with JSON only, no other words, matching this JSON Schema (${req.responseFormat.name}):\n${JSON.stringify(req.responseFormat.schema)}`);
  const tools = choice === "none" ? [] : (req.tools ?? []).filter((t) => t.kind !== "provided").map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: AGENT_MODEL, max_tokens: 4096, system: [{ type: "text", text: system.join("\n\n") }], messages: cached(msgs), ...(tools.length ? { tools: cachedTools(tools) } : {}) }),
  });
  const id = `turn_${crypto.randomUUID()}`;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.log("agent turn failed", res.status, detail.slice(0, 500));
    return { id, createdAt: Date.now(), status: "failed", output: [], error: { code: String(res.status), message: "Claude couldn't answer just now. Try again." } };
  }
  const r = (await res.json()) as {
    content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  };
  const output: AgAiOutputItem[] = [];
  const text = r.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
  if (text)
    output.push({ id: `msg_${crypto.randomUUID()}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: req.responseFormat?.type === "json" ? text.replace(/^```(?:json)?\s*|\s*```$/g, "") : text, annotations: [] }] });
  for (const b of r.content)
    if (b.type === "tool_use") output.push({ id: `call_${b.id}`, kind: "output", type: "function_call", callId: b.id!, name: b.name!, arguments: JSON.stringify(b.input ?? {}), status: "completed" });
  return {
    id,
    createdAt: Date.now(),
    status: r.stop_reason === "max_tokens" ? "incomplete" : "completed",
    ...(r.stop_reason === "max_tokens" ? { incompleteDetails: { reason: "max_output_tokens" as const } } : {}),
    output,
    usage: {
      inputTokens: r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0),
      outputTokens: r.usage.output_tokens,
      cachedInputTokens: r.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: r.usage.cache_creation_input_tokens ?? 0,
    },
    model: AGENT_MODEL,
  };
}
