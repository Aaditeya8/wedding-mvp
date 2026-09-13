import Link from "next/link";
import { Ornament } from "@/themes/ornaments";

export default async function StartSentPage({ searchParams }: { searchParams: Promise<{ e?: string; existing?: string; mail?: string }> }) {
  const { e, existing, mail } = await searchParams;

  if (mail === "failed") {
    return (
      <main data-theme="ivory-editorial" className="themed flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <p className="kicker rise rise-1">Your site is ready</p>
        <h1 className="font-display rise rise-2 mt-6 max-w-xl text-4xl tracking-tight md:text-5xl">
          …but the email didn&apos;t go through.
        </h1>
        <p className="rise rise-3 mt-6 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Your wedding was created{e ? ` for ${e}` : ""} — nothing is lost. Our mail is
          having a moment. Try{" "}
          <Link href="/signin" className="underline underline-offset-4">requesting a sign-in link</Link>{" "}
          in a minute, and it should reach you.
        </p>
        <div className="rise rise-3 mt-10"><Ornament theme="ivory-editorial" slot="hero" /></div>
      </main>
    );
  }

  return (
    <main data-theme="ivory-editorial" className="themed flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="kicker rise rise-1">{existing ? "Welcome back" : "Your site is ready"}</p>
      <h1 className="font-display rise rise-2 mt-6 max-w-xl text-4xl tracking-tight md:text-5xl">
        Check your inbox{e ? ` at ${e}` : ""}.
      </h1>
      <p className="rise rise-3 mt-6 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {existing
          ? "That email already has a wedding — we've sent a fresh sign-in link instead of making a second one."
          : "We've sent a sign-in link. Open it on any device to see your site, fill in the venues, and grab the link to share."}
        {" "}Nothing in a minute? Check spam, or <Link href="/signin" className="underline underline-offset-4">request another</Link>.
      </p>
      <div className="rise rise-3 mt-10"><Ornament theme="ivory-editorial" slot="hero" /></div>
    </main>
  );
}
