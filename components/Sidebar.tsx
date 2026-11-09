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
    items: [{ name: "Dashboard", href: "/dashboard", icon: "dashboard" }],
  },
  {
    title: "PEMERIKSAAN",
    items: [
      { name: "BPK", href: "/bpk", icon: "landmark" },
      { name: "Itjen", href: "/itjen", icon: "shield" },
    ],
  },
  {
    title: "DATA MANAGEMENT",
    items: [
      { name: "Rekomendasi", href: "/rekomendasi", icon: "list" },
      { name: "Laporan", href: "/laporan", icon: "report" },
    ],
  },
] as const;

type IconName = "dashboard" | "landmark" | "shield" | "list" | "report";

function MenuIcon({ name }: { name: IconName }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-[19px] w-[19px]",
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case "landmark":
      return (
        <svg {...props}>
          <path d="M3 9h18L12 3 3 9Z" />
          <path d="M5 10v9M9 10v9M15 10v9M19 10v9" />
          <path d="M3 19h18M2 22h20" />
        </svg>
      );

    case "shield":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );

    case "list":
      return (
        <svg {...props}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M8 8h8M8 12h8M8 16h8" />
        </svg>
      );

    case "report":
      return (
        <svg {...props}>
          <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v5h5M8 13h8M8 17h8" />
        </svg>
      );
  }
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");

    onClose();
    router.push("/login");
  };

  return (
    <>
      {/* OVERLAY */}
      <button
        type="button"
        aria-label="Tutup sidebar"
        onClick={onClose}
        className={`fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* SIDEBAR */}
      <aside
        className={`fixed left-0 top-0 z-[100] flex h-dvh w-[290px] flex-col border-r border-[#24364D] bg-[#09182B] text-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="border-b border-[#24364D] px-5 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#B9943C] bg-[#142B46]">
                <span className="text-sm font-bold text-[#D4A72C]">APF</span>
              </div>

              <div>
                <h1 className="text-base font-bold tracking-wide text-white">
                  APF
                </h1>
                <p className="mt-0.5 text-[9px] font-semibold tracking-[0.16em] text-[#D4A72C]">
                  COMMAND CENTER
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <p className="mt-5 text-[11px] text-slate-400">
            Bea Cukai Soekarno-Hatta
          </p>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {menuGroups.map((group, index) => (
            <div key={group.title} className={index > 0 ? "mt-8" : ""}>
              <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-3 transition-colors duration-200 ${
                        active
                          ? "border-[#D4A72C] bg-[#142B46] text-white"
                          : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          active
                            ? "bg-[#203C5B] text-[#D4A72C]"
                            : "bg-[#12243A] text-slate-400"
                        }`}
                      >
                        <MenuIcon name={item.icon} />
                      </span>

                      <span className="flex-1 text-[13px] font-medium">
                        {item.name}
                      </span>

                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D4A72C]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* SYSTEM STATUS */}
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-[#2B4055] bg-[#102139] px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />

              <div className="flex-1">
                <p className="text-[11px] font-semibold text-white">
                  System Online
                </p>
                <p className="mt-0.5 text-[9px] text-slate-400">
                  Data monitoring aktif
                </p>
              </div>

              <span className="text-[9px] text-green-400">Aktif</span>
            </div>
          </div>
        </div>

        {/* ADMIN PROFILE */}
        <div className="border-t border-[#24364D] p-4">
          <div className="flex items-center gap-3 px-1 py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D4A72C]/50 bg-white">
              <img
                src="/logobeacukai2.png"
                alt="Logo Bea Cukai"
                className="h-full w-full object-contain p-1"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                Administrator
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Admin APF Bea Cukai
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-lg border border-red-500/15 px-3 py-2.5 text-left text-xs font-medium text-red-400 transition hover:bg-red-500/[0.08]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 17l5-5-5-5M15 12H3" />
              <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
