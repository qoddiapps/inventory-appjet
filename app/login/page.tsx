import { redirect } from "next/navigation";
import { getPageSession } from "@/lib/page-auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getPageSession();
  if (session) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 shadow-lg shadow-brand-500/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-950" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
              <path d="M4 7l8-3 8 3v10l-8 3-8-3V7z" />
              <path d="M4 7l8 3 8-3M12 10v10" />
            </svg>
          </span>
          <div>
            <div className="text-base font-semibold leading-tight text-white">Stockroom</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Inventory OS</div>
          </div>
        </div>

        <section className="card p-6">
          <h1 className="text-xl font-semibold text-white">Administrator sign in</h1>
          <p className="mt-1.5 mb-5 text-sm leading-relaxed text-slate-400">
            Inventory, supplier and stock-movement data require an authenticated administrator session.
          </p>
          <LoginForm />
        </section>

        <p className="mt-6 text-center text-xs text-slate-500">
          Built by{" "}
          <a
            href="https://appjet.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-400 hover:text-brand-300"
          >
            AppJet
          </a>
          . This inventory application is 100% AI-generated.
        </p>
      </div>
    </main>
  );
}
