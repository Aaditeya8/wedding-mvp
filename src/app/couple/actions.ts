"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings } from "@/db/schema";
import { requireRole } from "@/lib/authz";

const schema = z.object({
  theme: z.enum(["ivory-editorial", "raj-mahal", "gulaab-rococo"]),
  weddingId: z.string().uuid(),
});

export async function setTheme(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const staff = await requireRole(["couple", "admin"]);
  const weddingId = staff.role === "admin" ? parsed.data.weddingId : staff.weddingId;
  if (!weddingId) return { ok: false, error: "forbidden" };

  const [wedding] = await db.update(weddings)
    .set({ theme: parsed.data.theme })
    .where(eq(weddings.id, weddingId))
    .returning();
  if (!wedding) return { ok: false, error: "wedding not found" };

  revalidatePath(`/w/${wedding.slug}`);
  revalidatePath("/couple");
  return { ok: true };
}
