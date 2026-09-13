import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { aiConfigured, chatComplete } from "@/lib/ai";
import { aiMapping, buildPrompt } from "@/lib/import/ai";
import { profileColumns } from "@/lib/import/profile";
import { heuristicMapping } from "@/lib/import/heuristic";
import type { EventRef } from "@/lib/import/mapping";
import type { Sheet } from "@/lib/import/spreadsheet";

const EVENTS: EventRef[] = [
  { id: "e-sangeet", name: "Sangeet", sortOrder: 0 },
  { id: "e-pheras", name: "Pheras", sortOrder: 1 },
  { id: "e-reception", name: "Reception", sortOrder: 2 },
];

const SHEET: Sheet = {
  name: "S", headerRow: 0,
  headers: ["Household", "Who", "Camp", "Contact", "Shaadi"],
  rows: [
    ["Sharma", "Rajesh, Sunita", "Bride", "sharma@x.com", "Y"],
    ["Mehta", "Vikram", "Groom", "mehta@x.com", "N"],
    ["Rao", "Suresh", "Bride", "rao@x.com", "Y"],
    ["Iyer", "K Iyer", "Bride", "iyer@x.com", "Y"],
    ["Khan", "Zoya", "Groom", "khan@x.com", "N"],
    ["Gupta", "Manoj", "Both", "gupta@x.com", "Y"],
    ["Bose", "Kabir", "Bride", "bose@x.com", "Y"],
  ],
};

type Captured = { url: string; body: any; headers: Record<string, string> };

function fakeFetch(reply: unknown, captured: Captured[] = [], status = 200): typeof fetch {
  return (async (url: any, init: any) => {
    captured.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    const content = typeof reply === "string" ? reply : JSON.stringify(reply);
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
  }) as typeof fetch;
}

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) saved[k] = process.env[k];
  process.env.AI_API_KEY = "test-key";
  delete process.env.AI_BASE_URL;
  delete process.env.AI_MODEL;
});
afterEach(() => {
  for (const k of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

describe("chatComplete", () => {
  it("is not configured without a key", () => {
    delete process.env.AI_API_KEY;
    expect(aiConfigured()).toBe(false);
  });

  it("posts an OpenAI-style chat request to Groq by default with JSON mode and low reasoning for gpt-oss", async () => {
    const captured: Captured[] = [];
    const out = await chatComplete({ system: "sys", user: "hi", json: true, fetchImpl: fakeFetch({ ok: 1 }, captured) });
    expect(out).toBe('{"ok":1}');
    expect(captured[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(captured[0].headers.Authorization).toBe("Bearer test-key");
    expect(captured[0].body.model).toBe("openai/gpt-oss-120b");
    expect(captured[0].body.response_format).toEqual({ type: "json_object" });
    expect(captured[0].body.reasoning_effort).toBe("low");
    expect(captured[0].body.messages).toEqual([{ role: "system", content: "sys" }, { role: "user", content: "hi" }]);
  });

  it("honours AI_BASE_URL and AI_MODEL and omits reasoning_effort for other models", async () => {
    process.env.AI_BASE_URL = "http://localhost:11434/v1/";
    process.env.AI_MODEL = "llama3";
    const captured: Captured[] = [];
    await chatComplete({ system: "s", user: "u", fetchImpl: fakeFetch("hello", captured) });
    expect(captured[0].url).toBe("http://localhost:11434/v1/chat/completions");
    expect(captured[0].body.model).toBe("llama3");
    expect(captured[0].body.reasoning_effort).toBeUndefined();
    expect(captured[0].body.response_format).toBeUndefined();
  });

  it("throws on a non-2xx reply", async () => {
    await expect(chatComplete({ system: "s", user: "u", fetchImpl: fakeFetch("x", [], 429) })).rejects.toThrow(/429/);
  });
});

describe("buildPrompt", () => {
  it("sends headers, kinds and at most five samples per column, plus events and the heuristic guess", () => {
    const profiles = profileColumns(SHEET);
    const base = heuristicMapping(profiles, EVENTS);
    const { system, user } = buildPrompt(profiles, EVENTS, base);
    expect(system).toMatch(/JSON/);
    expect(user).toContain("Household");
    expect(user).toContain("Shaadi");
    expect(user).toContain("Sangeet");
    expect(user).not.toContain("bose@x.com"); // 6th distinct value never leaves the server
    expect(user).toContain("sharma@x.com");   // samples are allowed (≤ 5)
  });
});

describe("aiMapping", () => {
  it("returns null when AI is not configured", async () => {
    delete process.env.AI_API_KEY;
    const profiles = profileColumns(SHEET);
    expect(await aiMapping(profiles, EVENTS, heuristicMapping(profiles, EVENTS))).toBeNull();
  });

  it("merges the model's answer over the heuristic and keeps its notes", async () => {
    const profiles = profileColumns(SHEET);
    const base = heuristicMapping(profiles, EVENTS);
    expect(base.fields.side).toBeNull(); // "Camp" isn't a synonym the heuristic knows
    const reply = {
      granularity: "family",
      fields: { familyName: 0, guestName: 1, side: 2, relation: null, email: 3, ageGroup: null, headcount: null, eventsList: null },
      eventColumns: { Pheras: 4, Nonsense: 9 },
      notes: ["“Camp” holds bride/groom values.", "“Shaadi” is the wedding ceremony (Pheras)."],
    };
    const res = await aiMapping(profiles, EVENTS, base, fakeFetch(reply));
    expect(res).not.toBeNull();
    expect(res!.mapping.fields).toMatchObject({ familyName: 0, guestName: 1, side: 2, email: 3 });
    expect(res!.mapping.eventColumns).toEqual({ "e-pheras": 4 });
    expect(res!.mapping.confidence.side).toBe(0.8);
    expect(res!.notes).toHaveLength(2);
  });

  it("ignores out-of-range column indexes and keeps the heuristic value", async () => {
    const profiles = profileColumns(SHEET);
    const base = heuristicMapping(profiles, EVENTS);
    const reply = { granularity: "family", fields: { email: 42 }, eventColumns: {}, notes: [] };
    const res = await aiMapping(profiles, EVENTS, base, fakeFetch(reply));
    expect(res!.mapping.fields.email).toBe(base.fields.email);
  });

  it("returns null on malformed JSON or a failing request", async () => {
    const profiles = profileColumns(SHEET);
    const base = heuristicMapping(profiles, EVENTS);
    expect(await aiMapping(profiles, EVENTS, base, fakeFetch("not json {"))).toBeNull();
    expect(await aiMapping(profiles, EVENTS, base, fakeFetch("{}", [], 500))).toBeNull();
  });
});
