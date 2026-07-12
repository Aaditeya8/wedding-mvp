"use server";
import { headers } from "next/headers";
import { submitRsvp } from "@/lib/rsvp";

export async function submitRsvpAction(input: {
  token: string;
  responses: { eventId: string; status: "attending" | "declined"; headcount: number; note?: string }[];
}) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  return submitRsvp(input, ip);
}
