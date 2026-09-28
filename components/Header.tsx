"use client";

import Link from "next/link";

type HeaderProps = {
  onMenuClick: () => void;
};

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071426]/90 text-white shadow-lg backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between px-5 lg:px-8">
        {/* =========================
            LEFT
        ========================== */}
        <div className="flex items-center gap-3">
          {/* MENU */}
          <button
            onClick={onMenuClick}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl transition hover:border-[#D4A72C]/50 hover:bg-[#D4A72C]/10 hover:text-[#D4A72C]"
            title="Buka Menu"
          >
            ☰
          </button>

          {/* HOME */}
          <Link
            href="/dashboard"
            className="hidden h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold transition hover:border-[#D4A72C]/50 hover:text-[#D4A72C] sm:flex"
          >
            <span className="text-lg">⌂</span>
            Home
          </Link>

          <div className="hidden h-8 w-px bg-white/10 sm:block" />

          {/* TITLE */}
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />

              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                Sistem Monitoring Aktif
              </span>
            </div>

            <h1 className="mt-1 text-sm font-bold text-white lg:text-base">
              APF Monitoring Center
            </h1>
          </div>
        </div>

        {/* =========================
            RIGHT
        ========================== */}
        <div className="flex items-center gap-3">
          {/* SEARCH */}
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 lg:flex">
            <span className="text-white/40">⌕</span>

            <input
              type="text"
              placeholder="Cari data..."
              className="w-32 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>

          {/* BEA CUKAI LOGO */}
          <div className="flex h-12 items-center rounded-xl border border-white/10 bg-white/5 px-3 transition hover:border-[#D4A72C]/40 hover:bg-white/10">
            <img
              src="/logobeacukai2.png"
              alt="Logo Bea Cukai"
              className="h-9 w-auto object-contain"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
