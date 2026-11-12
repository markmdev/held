import type { AgAiEvent, AgLlmAdapter, AgLlmResponse } from "ag-studio";

// AG Studio's agents run on Claude through Held's worker, which holds the key. Each turn comes back
// whole and is replayed to Studio as the events it would have streamed.
export const claudeAdapter: AgLlmAdapter = {
  executeTurn(request, options) {
    const complete: Promise<AgLlmResponse> = fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: options?.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok) return body as AgLlmResponse;
        return failed((body as { error?: string }).error ?? "Claude couldn't answer just now. Try again.", String(res.status));
      })
      .catch((e: Error) => (e.name === "AbortError" ? { ...failed("Stopped.", "aborted"), status: "cancelled" as const } : failed("The server didn't answer. Try again.", "network")));

    async function* events(): AsyncGenerator<AgAiEvent> {
      const res = await complete;
      for (const item of res.output) {
        if (item.type === "message") {
          const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("");
          yield { type: "TEXT_MESSAGE_START", messageId: item.id, role: "assistant" };
          yield { type: "TEXT_MESSAGE_CONTENT", messageId: item.id, delta: text };
          yield { type: "TEXT_MESSAGE_END", messageId: item.id };
        } else if (item.type === "function_call") {
          yield { type: "TOOL_CALL_START", toolCallId: item.callId, toolCallName: item.name };
          yield { type: "TOOL_CALL_ARGS", toolCallId: item.callId, delta: item.arguments };
          yield { type: "TOOL_CALL_END", toolCallId: item.callId };
        }
      }
    }
    return { stream: { [Symbol.asyncIterator]: events }, complete };
  },
};

function failed(message: string, code: string): AgLlmResponse {
  return { id: `turn_${crypto.randomUUID()}`, createdAt: Date.now(), status: "failed", output: [], error: { code, message } };
}
