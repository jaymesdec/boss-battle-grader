import Link from "next/link";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    return (
      <main className="mx-auto mt-24 max-w-xl rounded-xl border border-green-200 bg-green-50 p-8 text-green-900">
        <h1 className="text-2xl font-bold">Already signed in</h1>
        <p className="mt-2">You are authenticated as {session.user.name ?? session.user.email}.</p>
        <Link href="/teacher" className="mt-6 inline-block rounded bg-green-700 px-4 py-2 font-semibold text-white">
          Go to teacher dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-24 max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold">Boss Battle Grader Login</h1>
      <p className="mt-3 text-slate-700">
        Sign in with Franklin Canvas. Access is restricted to teacher-level Franklin accounts.
      </p>

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("canvas", { redirectTo: "/teacher" });
        }}
      >
        <button className="rounded bg-slate-900 px-5 py-2 font-semibold text-white" type="submit">
          Sign in with Canvas (Franklin)
        </button>
      </form>
    </main>
  );
}
