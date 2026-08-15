import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  async function requestLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    try {
      await signIn("nodemailer", { email, redirect: false });
    } catch {
      // Swallow AccessDenied etc. — never reveal which emails are provisioned
    }
    redirect("/signin?sent=1");
  }

  return (
    <main className="portal-page flex items-center justify-center p-6">
      <div className="portal-panel w-full max-w-md p-7 md:p-9">
        <p className="portal-eyebrow">Wedding operations</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Staff sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">Use the email address provisioned for your wedding role. We&apos;ll send a single-use link.</p>
        {sent ? (
          <p className="mt-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            If that address is on the team, a sign-in link is on its way. Check your email.
          </p>
        ) : (
          <form action={requestLink} className="mt-6 space-y-4">
            <label className="block">
              <span className="portal-eyebrow">Email address</span>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="portal-input mt-2"
            />
            </label>
            <button
              type="submit"
              className="portal-button w-full"
            >
              Email me a sign-in link
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
