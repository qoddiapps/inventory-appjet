"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 12h5l2 5 4-13 2 8h5" },
  { href: "/products", label: "Products", icon: "M4 7l8-3 8 3v10l-8 3-8-3V7zM4 7l8 3 8-3M12 10v10" },
  { href: "/categories", label: "Categories", icon: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v7H4zM13 14h7v7h-7z" },
  { href: "/suppliers", label: "Suppliers", icon: "M3 7h11v8H3zM14 10h4l3 3v2h-7zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" },
  { href: "/movements", label: "Stock Movements", icon: "M4 8h13l-3-3M20 16H7l3 3" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-semibold text-white">Stockroom</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
          aria-expanded={open}
          className="btn-ghost px-2.5 py-1.5"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      <aside
        className={`${open ? "block" : "hidden"} shrink-0 border-b border-white/8 px-4 py-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-8`}
      >
        <Link href="/" className="mb-8 hidden items-center gap-2.5 lg:flex">
          <Logo />
          <div>
            <div className="text-base font-semibold leading-tight text-white">Stockroom</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Inventory OS</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-brand-500/15 font-medium text-brand-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <a
          href="https://appjet.ai"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit AppJet.ai"
          className="group mt-8 block rounded-xl border border-white/8 bg-white/[0.03] p-3.5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5 lg:mt-auto"
        >
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
            Built by AppJet
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            100% AI-generated demo. Every line of code in this app was written by AppJet.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-400 group-hover:text-brand-300">
            appjet.ai
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </span>
        </a>
      </aside>
    </>
  );
}

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 shadow-lg shadow-brand-500/20">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-950" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
        <path d="M4 7l8-3 8 3v10l-8 3-8-3V7z" />
        <path d="M4 7l8 3 8-3M12 10v10" />
      </svg>
    </span>
  );
}
