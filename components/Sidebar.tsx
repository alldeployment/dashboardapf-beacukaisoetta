"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

const menuGroups = [
  {
    title: "OVERVIEW",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: "⌂",
      },
    ],
  },
  {
    title: "PEMERIKSAAN",
    items: [
      {
        name: "BPK",
        href: "/bpk",
        icon: "landmark",
      },
      {
        name: "Itjen",
        href: "/itjen",
        icon: "shield-check",
      },
    ],
  },
  {
    title: "DATA MANAGEMENT",
    items: [
      {
        name: "Rekomendasi",
        href: "/rekomendasi",
        icon: "☷",
      },
      {
        name: "Laporan",
        href: "/laporan",
        icon: "▤",
      },
    ],
  },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    // Hapus token/session yang mungkin digunakan
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");

    // Tutup sidebar
    onClose();

    // Arahkan ke halaman login
    router.push("/login");
  };

  return (
    <>
      {/* OVERLAY */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[90] bg-[#071426]/50 backdrop-blur-sm transition-opacity duration-300 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* SIDEBAR */}
      <aside
        className={`fixed left-0 top-0 z-[100] flex h-screen w-[290px] flex-col bg-[#071426] text-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="relative border-b border-white/10 px-6 py-6">
          <div className="absolute left-0 top-0 h-full w-1 bg-[#D4A72C]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4A72C]/40 bg-[#D4A72C]/10">
                <span className="text-sm font-bold text-[#D4A72C]">APF</span>
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-wide">APF</h1>

                <p className="text-[10px] font-medium tracking-[0.2em] text-[#D4A72C]">
                  COMMAND CENTER
                </p>
              </div>
            </div>

            {/* CLOSE */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <p className="mt-5 text-xs text-slate-400">
            Bea Cukai Soekarno-Hatta
          </p>
        </div>

        {/* MENU */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {menuGroups.map((group) => (
            <div key={group.title} className="mb-7">
              <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      className={`group relative flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${
                        active
                          ? "border-[#D4A72C]/40 bg-gradient-to-r from-[#D4A72C]/20 via-[#D4A72C]/10 to-[#D4A72C]/5 text-white shadow-[0_0_20px_rgba(212,167,44,0.10)]"
                          : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {/* GOLD ACTIVE INDICATOR */}
                      {active && (
                        <span className="absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full bg-[#D4A72C] shadow-[0_0_12px_rgba(212,167,44,0.8)]" />
                      )}

                      {/* ICON */}
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                          active
                            ? "border-[#D4A72C]/40 bg-[#D4A72C]/20 text-[#D4A72C]"
                            : "border-white/5 bg-white/[0.04] text-slate-400 group-hover:bg-white/10 group-hover:text-white"
                        }`}
                      >
                        {item.icon === "landmark" ? (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-5 w-5"
                          >
                            <path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M3 19h18M2 21h20M12 3 2 8h20L12 3Z" />
                          </svg>
                        ) : item.icon === "shield-check" ? (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
                            <path d="m9 12 2 2 4-4" />
                          </svg>
                        ) : (
                          <span className="text-lg">{item.icon}</span>
                        )}
                      </span>

                      {/* MENU NAME */}
                      <span className="text-sm font-medium">{item.name}</span>

                      {/* GOLD STATUS DOT */}
                      {active && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-[#D4A72C] shadow-[0_0_10px_rgba(212,167,44,0.8)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* SYSTEM STATUS */}
        <div className="px-5 pb-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />

                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
              </span>

              <div>
                <p className="text-xs font-semibold text-white">
                  System Online
                </p>

                <p className="text-[10px] text-slate-500">
                  Data monitoring aktif
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ADMIN */}
        <div className="border-t border-white/10 p-5">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#D4A72C]/40 bg-white shadow-lg">
                <img
                  src="/logobeacukai2.png"
                  alt="Logo Bea Cukai"
                  className="h-full w-full object-contain p-1"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  Administrator
                </p>

                <p className="text-[11px] text-slate-500">
                  Admin APF Bea Cukai
                </p>
              </div>
            </div>

            {/* LOGOUT */}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-3 rounded-lg border border-red-400/10 bg-red-500/5 px-3 py-2.5 text-left text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-base">
                ⇥
              </span>

              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
