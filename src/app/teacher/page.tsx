import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL ?? "https://franklinjc.instructure.com";

type CanvasProfile = {
  id?: number;
  name?: string;
  primary_email?: string;
  avatar_url?: string;
  title?: string;
};

export default async function TeacherPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto mt-24 max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-amber-950">
        <h1 className="text-2xl font-bold">Not authenticated</h1>
        <p className="mt-2">Please log in with Canvas to access this page.</p>
        <Link href="/login" className="mt-6 inline-block rounded bg-amber-700 px-4 py-2 font-semibold text-white">
          Go to login
        </Link>
      </main>
    );
  }

  let profile: CanvasProfile | null = null;
  if (session.canvasAccessToken) {
    const response = await fetch(`${CANVAS_BASE_URL}/api/v1/users/self/profile`, {
      headers: { Authorization: `Bearer ${session.canvasAccessToken}` },
      cache: "no-store",
    });
    if (response.ok) {
      profile = (await response.json()) as CanvasProfile;
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold">Franklin Teacher Dashboard</h1>
      <p className="mt-2 text-slate-600">Protected page sanity check for Canvas-authenticated teachers.</p>

      <div className="mt-6 space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
        <p><span className="font-semibold">Session user:</span> {session.user.name ?? "Unknown"}</p>
        <p><span className="font-semibold">Email:</span> {session.user.email ?? "Unknown"}</p>
        <p><span className="font-semibold">Canvas domain:</span> {session.canvasDomain ?? "Not set"}</p>
        <p><span className="font-semibold">Teacher verified:</span> {session.isFranklinTeacher ? "Yes" : "No"}</p>
        <p><span className="font-semibold">Canvas profile:</span> {profile?.name ?? "Unavailable"}</p>
        <p><span className="font-semibold">Canvas title:</span> {profile?.title ?? "Unavailable"}</p>
        <p><span className="font-semibold">Canvas user ID:</span> {profile?.id ?? "Unavailable"}</p>
      </div>

      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded bg-slate-900 px-4 py-2 font-semibold text-white">Open app</Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="rounded border border-slate-300 px-4 py-2 font-semibold text-slate-900">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
