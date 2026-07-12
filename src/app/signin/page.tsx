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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">Staff sign in</h1>
        {sent ? (
          <p className="text-sm">
            If that address is on the team, a sign-in link is on its way.
            Check your email.
          </p>
        ) : (
          <form action={requestLink} className="space-y-4">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full rounded border border-neutral-300 px-3 py-2"
            />
            <button
              type="submit"
              className="w-full rounded bg-neutral-900 px-3 py-2 text-white"
            >
              Email me a sign-in link
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
