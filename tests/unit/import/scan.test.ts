import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractTextFromFile, parseGuestText, householdsToRows, aiExtractHouseholds } from "@/lib/import/scan";
import type { EventRef } from "@/lib/import/mapping";

const EVENTS: EventRef[] = [
  { id: "e-sangeet", name: "Sangeet", sortOrder: 0 },
  { id: "e-pheras", name: "Pheras", sortOrder: 1 },
  { id: "e-reception", name: "Reception", sortOrder: 2 },
];

describe("extractTextFromFile", () => {
  it("pulls paragraphs out of a docx", async () => {
    const xml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
      <w:p><w:r><w:t>Bride side</w:t></w:r></w:p>
      <w:p><w:r><w:t>1. Sharma family</w:t></w:r><w:r><w:t xml:space="preserve"> - 4</w:t></w:r></w:p>
      <w:p/></w:body></w:document>`;
    const zip = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(xml) });
    expect(await extractTextFromFile(zip, "list.docx")).toEqual({ kind: "text", text: "Bride side\n1. Sharma family - 4" });
  });
  it("returns text files as-is and marks images for vision", async () => {
    expect(await extractTextFromFile(new TextEncoder().encode("a\r\nb"), "notes.txt")).toEqual({ kind: "text", text: "a\nb" });
    expect(await extractTextFromFile(new Uint8Array([0x89, 0x50]), "photo.png")).toEqual({ kind: "image", mime: "image/png" });
    expect(await extractTextFromFile(new Uint8Array([0xff, 0xd8]), "IMG_0042.JPG")).toEqual({ kind: "image", mime: "image/jpeg" });
  });
  it("reads the text layer of a pdf", async () => {
    const pdf = [
      "%PDF-1.1",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
      "4 0 obj << /Length 52 >> stream",
      "BT /F1 18 Tf 20 100 Td (Sharma family - 4) Tj ET",
      "endstream endobj",
      "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      "trailer << /Root 1 0 R >>",
    ].join("\n");
    const res = await extractTextFromFile(new TextEncoder().encode(pdf), "list.pdf");
    expect(res.kind).toBe("text");
    expect((res as { text: string }).text).toContain("Sharma family - 4");
  });
  it("rejects unknown file types", async () => {
    await expect(extractTextFromFile(new Uint8Array([1]), "x.zip")).rejects.toThrow(/photo.*PDF.*Word/i);
  });
});

describe("parseGuestText", () => {
  it("reads numbered lines with counts, names, side headings, emails and event hints", () => {
    const text = `Guest List
Ladki wale
1. Sharma family - 4
2) Rajesh Mehta, Kavita Mehta & 2 kids
Mama ji + 3 (reception only)

Groom side:
- Zoya Khan (zoya@example.com)
- The Guptas x5
Deshmukh masa: Bunty, Chintu, Pinky
Total: 20`;
    const hs = parseGuestText(text);
    expect(hs).toHaveLength(6);
    expect(hs[0]).toMatchObject({ name: "Sharma family", members: [], headcount: 4, side: "bride" });
    expect(hs[1]).toMatchObject({ members: ["Rajesh Mehta", "Kavita Mehta"], headcount: 4, side: "bride" });
    expect(hs[2]).toMatchObject({ name: "Mama ji", headcount: 4, side: "bride", events: ["reception"] });
    expect(hs[3]).toMatchObject({ members: ["Zoya Khan"], email: "zoya@example.com", side: "groom" });
    expect(hs[4]).toMatchObject({ name: "The Guptas", headcount: 5, side: "groom" });
    expect(hs[5]).toMatchObject({ name: "Deshmukh masa", members: ["Bunty", "Chintu", "Pinky"], side: "groom" });
  });
  it("treats a bare name line as one household of one person", () => {
    const [h] = parseGuestText("Priya Nair");
    expect(h).toMatchObject({ members: ["Priya Nair"] });
    expect(h.name).toBeUndefined();
  });
});

describe("householdsToRows", () => {
  it("turns extracted households into review rows with placeholders, events and flags", () => {
    const rows = householdsToRows(parseGuestText("Ladki wale\nSharma family - 3\nPriya Nair, Kabir Bose (sangeet, reception)\nMama ji: Suresh, Riya (child)"), EVENTS);
    expect(rows[0]).toMatchObject({ name: "Sharma family", side: "bride", eventIds: EVENTS.map((e) => e.id) });
    expect(rows[0].members.map((m) => m.fullName)).toEqual(["Guest 1", "Guest 2", "Guest 3"]);
    expect(rows[0].issues).toEqual(["missing_email"]);
    expect(rows[1].name).toBe("Nair Family");
    expect(rows[1].eventIds).toEqual(["e-sangeet", "e-reception"]);
    expect(rows[2].members).toEqual([{ fullName: "Suresh", ageGroup: "adult" }, { fullName: "Riya", ageGroup: "child" }]);
    expect(rows.every((r) => r.key)).toBe(true);
  });
});

type Captured = { body: any };
function fakeFetch(reply: unknown, captured: Captured[] = []): typeof fetch {
  return (async (_url: any, init: any) => {
    captured.push({ body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), { status: 200 });
  }) as typeof fetch;
}
const saved: Record<string, string | undefined> = {};
beforeEach(() => { for (const k of ["AI_API_KEY", "AI_VISION_MODEL"]) saved[k] = process.env[k]; process.env.AI_API_KEY = "k"; delete process.env.AI_VISION_MODEL; });
afterEach(() => { for (const k of ["AI_API_KEY", "AI_VISION_MODEL"]) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("aiExtractHouseholds", () => {
  it("sends text to the chat model and validates the households it returns", async () => {
    const captured: Captured[] = [];
    const reply = { households: [{ name: "Sharma family", members: ["Rajesh"], headcount: 4, side: "bride", events: ["Reception"] }, { members: [] }], notes: ["one line was a total"] };
    const res = await aiExtractHouseholds({ text: "Sharma family - 4" }, EVENTS, fakeFetch(reply, captured));
    expect(res!.households).toHaveLength(1);
    expect(res!.households[0]).toMatchObject({ name: "Sharma family", headcount: 4, side: "bride", events: ["Reception"] });
    expect(res!.notes).toEqual(["one line was a total"]);
    expect(captured[0].body.messages[1].content).toContain("Sharma family - 4");
    expect(captured[0].body.model).toBe("openai/gpt-oss-120b");
  });
  it("sends images as image_url parts to the vision model", async () => {
    const captured: Captured[] = [];
    await aiExtractHouseholds({ images: ["data:image/png;base64,AAAA"] }, EVENTS, fakeFetch({ households: [] }, captured));
    const content = captured[0].body.messages[1].content;
    expect(Array.isArray(content)).toBe(true);
    expect(content.find((p: any) => p.type === "image_url").image_url.url).toBe("data:image/png;base64,AAAA");
    expect(captured[0].body.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(captured[0].body.reasoning_effort).toBeUndefined();
  });
  it("returns null without a key or on garbage", async () => {
    delete process.env.AI_API_KEY;
    expect(await aiExtractHouseholds({ text: "x" }, EVENTS)).toBeNull();
    process.env.AI_API_KEY = "k";
    expect(await aiExtractHouseholds({ text: "x" }, EVENTS, fakeFetch("nope"))).toBeNull();
  });
});
