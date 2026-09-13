"use server";
import { headers } from "next/headers";
import { submitOpenRsvp, type OpenRsvpInput } from "@/lib/open-rsvp";

export async function submitOpenRsvpAction(input: OpenRsvpInput) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  return submitOpenRsvp(input, ip);
}
