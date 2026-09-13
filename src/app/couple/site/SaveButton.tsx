"use client";
import { useFormStatus } from "react-dom";

export function SaveButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="portal-button">
      {pending ? "Saving…" : label}
    </button>
  );
}
