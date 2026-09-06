/**
 * One seam over any OpenAI-compatible chat endpoint. Groq by default (free tier),
 * swappable to OpenAI / OpenRouter / Ollama with two env vars.
 *
 *   AI_API_KEY   required to enable anything AI-assisted
 *   AI_BASE_URL  default https://api.groq.com/openai/v1
 *   AI_MODEL     default openai/gpt-oss-120b
 */

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

export function aiConfigured(): boolean {
  return !!process.env.AI_API_KEY;
}

export function aiModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

export async function chatComplete(args: {
  system: string;
  user: string;
  json?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI not configured (AI_API_KEY unset)");
  const base = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = aiModel();
  const doFetch = args.fetchImpl ?? fetch;

  const body: Record<string, unknown> = {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
  };
  if (args.json) body.response_format = { type: "json_object" };
  // gpt-oss models spend their budget "thinking" unless told not to
  if (/gpt-oss/i.test(model)) body.reasoning_effort = "low";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 20_000);
  try {
    const res = await doFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI request failed: HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("AI reply had no content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}
