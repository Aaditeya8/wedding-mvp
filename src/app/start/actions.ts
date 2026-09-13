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
  try {
    await signIn("nodemailer", { email: res.email, redirect: false, redirectTo: "/couple/site" });
  } catch {
    // never reveal provisioning state; the magic link goes out (or to the outbox) either way
  }
  redirect(`/start/sent?e=${encodeURIComponent(res.email)}${res.created ? "" : "&existing=1"}`);
}
