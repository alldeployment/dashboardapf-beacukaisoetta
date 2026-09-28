"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    // Login sementara
    if (username === "adminapf" && password === "apf2026") {
      localStorage.setItem("token", "apf-admin-session");

      localStorage.setItem(
        "user",
        JSON.stringify({
          username: "admin",
          role: "Administrator",
          name: "Administrator",
        })
      );

      router.push("/dashboard");
      return;
    }

    setError("Username atau password salah.");
    setLoading(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426]">
      {/* =====================================================
          BACKGROUND FOTO
          GANTI FOTO DI:
          /public/login-bg.jpg
      ====================================================== */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bcsoetta2.jpg')",
        }}
      />

      {/* Overlay gelap supaya foto terlihat samar */}
      <div className="absolute inset-0 bg-[#071426]/45" />

      {/* Efek gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#071426]/55 via-[#071426]/25 to-[#071426]/50" />

      {/* Efek cahaya */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#D4A72C]/10 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      {/* =====================================================
          LOGIN CONTENT
      ====================================================== */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          {/* Logo / Branding */}
          {/* Logo / Branding */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#D4A72C]/40 bg-[#071426]/70 shadow-2xl backdrop-blur-md overflow-hidden">
              <img
                src="/logobeacukai2.png"
                alt="Logo Bea Cukai"
                className="h-full w-full object-contain p-2"
              />
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.35em] text-[#D4A72C]">
              BEA CUKAI SOEKARNO-HATTA
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              APF Monitoring Center
            </h1>

            <p className="mt-2 text-sm text-white/60">
              Monitoring Tindak Lanjut Rekomendasi Pemeriksaan
            </p>
          </div>

          {/* =================================================
              LOGIN CARD
          ================================================== */}
          <div className="rounded-3xl border border-white/15 bg-white/[0.09] p-7 shadow-2xl backdrop-blur-xl sm:p-9">
            {/* Card Header */}
            <div className="mb-7">
              <h2 className="text-xl font-bold text-white">Selamat Datang</h2>

              <p className="mt-1 text-sm text-white/55">
                Silakan masuk untuk mengakses sistem monitoring.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-semibold text-white/80"
                >
                  Username
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    autoComplete="username"
                    className="w-full rounded-xl border border-white/15 bg-black/20 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#D4A72C] focus:bg-black/30 focus:ring-2 focus:ring-[#D4A72C]/10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-white/80"
                >
                  Password
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-white/15 bg-black/20 py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#D4A72C] focus:bg-black/30 focus:ring-2 focus:ring-[#D4A72C]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-[#D4A72C]"
                  >
                    {showPassword ? (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="m4 4 16 16" />
                      </svg>
                    ) : (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">!</span>

                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-[#D4A72C] py-3.5 text-sm font-bold text-[#071426] shadow-lg shadow-[#D4A72C]/10 transition hover:bg-[#e5ba45] hover:shadow-[#D4A72C]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="relative z-10">
                  {loading ? "Memproses..." : "Masuk"}
                </span>
              </button>
            </form>

            {/* Demo info */}
            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="text-center text-xs text-white/40">
                  Sistem Pemeriksaan APF
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-white/35">
            © 2026 Bea Cukai Soekarno-Hatta
          </p>
        </div>
      </div>
    </main>
  );
}
