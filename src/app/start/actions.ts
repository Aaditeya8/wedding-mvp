"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { createWeddingForCouple } from "@/lib/signup";
import { rateLimit } from "@/lib/ratelimit";

export type StartState = { error?: string; values?: Record<string, string> };

export async function startWedding(_prev: StartState, formData: FormData): Promise<StartState> {
  const values = Object.fromEntries(
    ["brideName", "groomName", "weddingDate", "city", "email", "theme"].map((k) => [k, String(formData.get(k) ?? "").trim()]),
  );
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!rateLimit(`start:${ip}`, { max: 5, windowMs: 10 * 60_000 })) {
    return { error: "A little too fast — give it a few minutes and try again.", values };
  }
  const res = await createWeddingForCouple(values);
  if (!res.ok) return { error: "Please check the details — every field is needed, and the date should be in the future.", values };
  // If the mail can't go out, say so. The couple has just handed us their wedding;
  // telling them to check an inbox nothing was sent to is the worst possible lie,
  // because they have no way to tell it from a slow inbox. (`redirect: false` keeps
  // signIn from throwing a redirect, so anything caught here is a real failure.)
  let mailed = true;
  try {
    await signIn("nodemailer", { email: res.email, redirect: false, redirectTo: "/couple/site" });
  } catch (e) {
    mailed = false;
    console.error("[start] sign-in mail failed for a new wedding:", e instanceof Error ? e.message : e);
  }
  const q = new URLSearchParams({ e: res.email });
  if (!res.created) q.set("existing", "1");
  if (!mailed) q.set("mail", "failed");
  redirect(`/start/sent?${q}`);
}
