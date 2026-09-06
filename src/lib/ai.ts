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
const DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export function aiConfigured(): boolean {
  return !!process.env.AI_API_KEY;
}

export function aiModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

export function aiVisionModel(): string {
  return process.env.AI_VISION_MODEL || DEFAULT_VISION_MODEL;
}

export async function chatComplete(args: {
  system: string;
  user: string;
  /** data: URLs; switches to the vision model */
  images?: string[];
  json?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI not configured (AI_API_KEY unset)");
  const base = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const images = args.images ?? [];
  const model = images.length ? aiVisionModel() : aiModel();
  const doFetch = args.fetchImpl ?? fetch;

  const userContent = images.length
    ? [{ type: "text", text: args.user }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))]
    : args.user;
  const body: Record<string, unknown> = {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: userContent },
    ],
  };
  if (args.json) body.response_format = { type: "json_object" };
  // gpt-oss models spend their budget "thinking" unless told not to
  if (/gpt-oss/i.test(model)) body.reasoning_effort = "low";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? (images.length ? 60_000 : 20_000));
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
