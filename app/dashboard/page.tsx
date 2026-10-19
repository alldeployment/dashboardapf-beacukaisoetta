"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Summary = {
  total: number;
  belumTl: number;
  sudahTl: number;
  sudahTuntas: number;
  masukSaldo: number;
  belumSaldo: number;
  persentaseSaldo: number;
  persentaseBelumSaldo: number;
  capaian: number;

  bpk: {
    total: number;
    masukSaldo: number;
    belumSaldo: number;
    keuangan: number;
    bukanKeuangan: number;
    persentaseSaldo: number;
  };

  itjen: {
    total: number;
    belumTl: number;
    sudahTl: number;
    sudahTuntas: number;
  };
};

type Recommendation = {
  id: number;
  source: string;
  category: string;
  lha_number: string;
  lha_date: string;
  recommendation_count: number;
  follow_up_status: string;
  saldo_status: string;
  description: string | null;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [capaianData, setCapaianData] = useState<{
    capaian_manual: number;
    capaian_otomatis: number;
    indeks_capaian: number;
    indeks_capaian_manual: number;
    indeks_capaian_otomatis: number;
    indeks_capaian_mode: "MANUAL" | "OTOMATIS";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [summaryRes, recommendationRes, capaianRes] = await Promise.all([
        fetch("/api/dashboard/summary", {
          cache: "no-store",
        }),
        fetch("/api/recommendations", {
          cache: "no-store",
        }),
        fetch("/api/dashboard/capaian", {
          cache: "no-store",
        }),
      ]);

      const summaryJson = await summaryRes.json();
      const recommendationJson = await recommendationRes.json();
      const capaianJson = await capaianRes.json();

      console.log("Status API Capaian:", capaianRes.status);
      console.log("Data API Capaian:", capaianJson);

      if (!summaryRes.ok || !summaryJson?.ok) {
        throw new Error(
          summaryJson?.message || "Gagal mengambil summary dashboard"
        );
      }

      if (!recommendationRes.ok || !recommendationJson?.ok) {
        throw new Error(
          recommendationJson?.message || "Gagal mengambil data rekomendasi"
        );
      }

      setSummary(summaryJson.data ?? null);
      setRecommendations(recommendationJson.data ?? []);
      setCapaianData(capaianJson.data ?? null);
    } catch (err) {
      console.error("DASHBOARD ERROR:", err);

      setError(
        err instanceof Error ? err.message : "Data dashboard gagal dimuat."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const safeNumber = (value: unknown): number => {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  };

  const safePercentage = (value: unknown, total: unknown): number => {
    const numerator = safeNumber(value);
    const denominator = safeNumber(total);

    if (denominator <= 0) return 0;

    const result = (numerator / denominator) * 100;

    if (!Number.isFinite(result)) return 0;

    return Math.min(100, Math.max(0, Math.round(result)));
  };

  const formatDate = (date: string) => {
    if (!date) return "-";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const getSaldoStatusLabel = (status: string) => {
    switch (status) {
      case "MASUK_SALDO":
        return "Masuk Saldo";

      case "BELUM_SALDO":
        return "Belum Masuk Saldo";

      case "TIDAK_RELEVAN":
        return "Tidak Relevan";

      default:
        return "Belum Diketahui";
    }
  };
  const getSaldoStatusStyle = (status: string) => {
    switch ((status ?? "").trim().toUpperCase()) {
      case "MASUK_SALDO":
        return "bg-green-50 text-green-700 border-green-200";
      case "BELUM_SALDO":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "SUDAH_TUNTAS":
        return "bg-green-50 text-green-700 border-green-200";

      case "BELUM_TL":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  /*
  ============================================================
  DATA SUMMARY
  ============================================================
  */

  const total = safeNumber(summary?.total);
  const belumTl = safeNumber(summary?.belumTl);
  const sudahTl = safeNumber(summary?.sudahTl);
  const sudahTuntas = safeNumber(summary?.sudahTuntas);
  // RINGKASAN SALDO GLOBAL
  const masukSaldoGlobal = safeNumber(summary?.masukSaldo);
  const belumSaldoGlobal = safeNumber(summary?.belumSaldo);
  const persentaseSaldoGlobal = safeNumber(summary?.persentaseSaldo);
  const capaianOtomatis = safeNumber(
    capaianData?.capaian_otomatis ?? summary?.capaian
  );

  const capaianPersen = Math.round(capaianOtomatis * 100);

  // API mengirim indeks dalam bentuk rasio.
  // Contoh: 0.75 = 75%, sedangkan 1.2 = 120%.
  const indeksCapaianPersen = Math.round(
    safeNumber(capaianData?.indeks_capaian) * 100
  );

  const indeksCapaianBar = Math.min(120, Math.max(0, indeksCapaianPersen));
  /*
  ============================================================
  BPK
  ============================================================
  */

  const bpkData = {
    total: safeNumber(summary?.bpk?.total),
    masukSaldo: safeNumber(summary?.bpk?.masukSaldo),
    belumSaldo: safeNumber(summary?.bpk?.belumSaldo),
    keuangan: safeNumber(summary?.bpk?.keuangan),
    bukanKeuangan: safeNumber(summary?.bpk?.bukanKeuangan),
    persentaseSaldo: safeNumber(summary?.bpk?.persentaseSaldo),
  };

  const persentaseSaldo = safePercentage(bpkData.masukSaldo, bpkData.total);

  const persentaseBelumSaldo = safePercentage(
    bpkData.belumSaldo,
    bpkData.total
  );

  /*
  ============================================================
  ITJEN
  ============================================================
  */

  const itjenData = {
    total: safeNumber(summary?.itjen?.total),
    belumTl: safeNumber(summary?.itjen?.belumTl),
    sudahTl: safeNumber(summary?.itjen?.sudahTl),
    sudahTuntas: safeNumber(summary?.itjen?.sudahTuntas),
  };

  const persentaseTuntas = safePercentage(
    itjenData.sudahTuntas,
    itjenData.total
  );

  const persentaseSudahTl = safePercentage(itjenData.sudahTl, itjenData.total);

  const persentaseBelumTl = safePercentage(itjenData.belumTl, itjenData.total);

  const normalizeFollowUpStatus = (value: string) => {
    const status = (value ?? "").trim().toUpperCase();

    if (status === "BELUM_TUNTAS") return "SUDAH_TL";

    return status;
  };

  const groupedRecommendations = new Map<
    string,
    { item: Recommendation; group: Recommendation[] }
  >();

  for (const item of recommendations) {
    const source = (item.source ?? "").trim().toUpperCase();
    const lhaNumber = (item.lha_number ?? "").trim();

    // Jika nomor LHA kosong, pisahkan berdasarkan ID rekomendasi.
    const key = lhaNumber
      ? `${source}::${lhaNumber}`
      : `${source}::ID-${item.id}`;

    const existing = groupedRecommendations.get(key);

    if (existing) {
      existing.group.push(item);
    } else {
      groupedRecommendations.set(key, {
        item,
        group: [item],
      });
    }
  }

  const recentData = Array.from(groupedRecommendations.values())
    .map(({ item, group }) => {
      const statuses = group.map((rec) =>
        normalizeFollowUpStatus(rec.follow_up_status)
      );

      const belumTlCount = statuses.filter(
        (status) => status === "BELUM_TL"
      ).length;

      const sudahTlCount = statuses.filter(
        (status) => status === "SUDAH_TL"
      ).length;

      const sudahTuntasCount = statuses.filter(
        (status) => status === "SUDAH_TUNTAS"
      ).length;

      let folderStatus = "SUDAH_TUNTAS";

      if (belumTlCount > 0) {
        folderStatus = "BELUM_TL";
      } else if (sudahTlCount > 0) {
        folderStatus = "SUDAH_TL";
      }

      const dateValue = new Date(item.lha_date).getTime();

      return {
        ...item,
        recommendation_count: group.length,
        follow_up_status: folderStatus,
        belumTlCount,
        sudahTlCount,
        sudahTuntasCount,
        sortDate: Number.isFinite(dateValue) ? dateValue : 0,
      };
    })
    .sort((a, b) => b.sortDate - a.sortDate)
    .slice(0, 5);

  /*
  ============================================================
  RENDER
  ============================================================
  */

  return (
    <main
      className="relative min-h-screen bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: "url('/bcsoetta.jpg')",
      }}
    >
      <div className="fixed inset-0 -z-0 bg-[#071426]/80" />

      <div className="relative z-10 min-h-screen bg-white/5 px-6 py-8 lg:px-8">
        {/* HEADER */}
        <section className="mb-8">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D4A72C] shadow-[0_0_10px_#D4A72C]" />

                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
                  APF Monitoring Center
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white">
                Dashboard Monitoring APF
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                Pusat monitoring tindak lanjut rekomendasi hasil pemeriksaan BPK
                dan Inspektorat Jenderal pada Bea Cukai Soekarno-Hatta.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/rekomendasi"
                className="rounded-xl bg-[#D4A72C] px-5 py-3 text-sm font-semibold text-[#071426] shadow-lg transition hover:bg-[#E5BA45]"
              >
                + Tambah Rekomendasi
              </Link>

              <Link
                href="/laporan"
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
              >
                Lihat Laporan
              </Link>
            </div>
          </div>
        </section>
        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-lg">
            {error}
          </div>
        )}
        {/* EXECUTIVE SUMMARY */}
        <section className="mb-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F0C85A]">
              Executive Summary
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              Ringkasan Kinerja APF
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* TOTAL */}

            <div className="rounded-2xl border border-white/10 bg-white/95 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Rekomendasi
                </span>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#071426] text-sm font-bold text-white">
                  APF
                </div>
              </div>

              <p className="text-3xl font-bold text-[#071426]">
                {loading ? "—" : total}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Seluruh rekomendasi BPK & Itjen
              </p>
            </div>

            {/* BELUM TL */}

            <div className="rounded-2xl border border-red-100 bg-white/95 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Belum TL
                </span>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  !
                </div>
              </div>

              <p className="text-3xl font-bold text-red-600">
                {loading ? "—" : belumTl}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Belum dilakukan tindak lanjut
              </p>
            </div>

            {/* SUDAH TL */}

            <div className="rounded-2xl border border-amber-100 bg-white/95 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sudah TL
                </span>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  ◐
                </div>
              </div>

              <p className="text-3xl font-bold text-amber-600">
                {loading ? "—" : sudahTl}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Sudah dilakukan tindak lanjut
              </p>
            </div>

            {/* TUNTAS */}

            <div className="rounded-2xl border border-green-100 bg-white/95 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sudah Tuntas
                </span>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                  ✓
                </div>
              </div>

              <p className="text-3xl font-bold text-green-600">
                {loading ? "—" : sudahTuntas}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Tindak lanjut telah selesai
              </p>
            </div>
          </div>
        </section>

        {/* RINGKASAN SALDO GLOBAL - TAMBAHAN BARU */}
        <section className="mb-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F0C85A]"></p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Status Saldo Seluruh Rekomendasi
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Rekapitulasi saldo rekomendasi BPK dan ITJEN secara keseluruhan.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* MASUK SALDO */}
            <div className="rounded-2xl border border-green-100 bg-white/95 p-5 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-green-700">
                Masuk Saldo
              </p>
              <p className="mt-3 text-3xl font-bold text-green-600">
                {loading ? "—" : masukSaldoGlobal.toLocaleString("id-ID")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Total rekomendasi yang masuk saldo
              </p>
            </div>

            {/* BELUM MASUK SALDO */}
            <div className="rounded-2xl border border-orange-100 bg-white/95 p-5 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
                Belum Masuk Saldo
              </p>
              <p className="mt-3 text-3xl font-bold text-orange-600">
                {loading ? "—" : belumSaldoGlobal.toLocaleString("id-ID")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Total rekomendasi yang belum masuk saldo
              </p>
            </div>

            {/* PERSENTASE SALDO */}
            <div className="rounded-2xl border border-blue-100 bg-white/95 p-5 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Persentase Saldo
              </p>
              <p className="mt-3 text-3xl font-bold text-blue-600">
                {loading
                  ? "—"
                  : `${persentaseSaldoGlobal.toLocaleString("id-ID", {
                      maximumFractionDigits: 2,
                    })}%`}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Persentase rekomendasi yang masuk saldo
              </p>
            </div>
          </div>
        </section>

        {/* CAPAIAN KESELURUHAN */}
        <section className="mb-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* CAPAIAN OTOMATIS BERDASARKAN RUMUS */}
            <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl">
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9B7518]">
                    Capaian Otomatis
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-[#071426]">
                    Hasil Perhitungan Sistem
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Berdasarkan perhitungan capaian rekomendasi yang diterima
                    dari sistem.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, capaianPersen))}%`,
                      }}
                    />
                  </div>
                  <span className="min-w-[80px] text-right text-3xl font-bold text-[#071426]">
                    {loading ? "—" : `${capaianPersen}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* INDEKS CAPAIAN */}
            <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl">
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9B7518]">
                    Capaian Keseluruhan
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-[#071426]">
                    Indeks Capaian Tindak Lanjut
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Nilai indeks capaian keseluruhan yang tersimpan pada sistem.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#D4A72C] transition-all"
                      style={{
                        width: `${(indeksCapaianBar / 120) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="min-w-[80px] text-right text-3xl font-bold text-[#071426]">
                    {loading ? "—" : `${indeksCapaianPersen}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BPK */}
        <section className="mb-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F0C85A]">
              BPK Monitoring
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              Monitoring Saldo Rekomendasi BPK
            </h2>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            {/* SALDO */}

            <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl">
              <div className="mb-6">
                <h3 className="font-bold text-[#071426]">Persentase Saldo</h3>

                <p className="mt-1 text-xs text-slate-400">
                  Status saldo rekomendasi BPK
                </p>
              </div>

              <div className="flex items-center justify-center">
                <div
                  className="relative flex h-48 w-48 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(
                      #16A34A ${persentaseSaldo}%,
                      #E2E8F0 ${persentaseSaldo}% 100%
                    )`,
                  }}
                >
                  <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-4xl font-bold text-[#071426]">
                      {persentaseSaldo}%
                    </span>

                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Masuk Saldo
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-xs text-green-600">Masuk Saldo</p>

                  <p className="mt-1 text-xl font-bold text-green-700">
                    {bpkData.masukSaldo}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-xs text-slate-500">Belum Saldo</p>

                  <p className="mt-1 text-xl font-bold text-slate-700">
                    {bpkData.belumSaldo}
                  </p>
                </div>
              </div>
            </div>

            {/* CATEGORY */}

            <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl">
              <div className="mb-6">
                <h3 className="font-bold text-[#071426]">
                  Klasifikasi Rekomendasi
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Distribusi rekomendasi berdasarkan kategori pemeriksaan
                </p>
              </div>

              <div className="space-y-7">
                {/* KEUANGAN */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#071426]" />
                      Laporan Keuangan
                    </span>

                    <span className="text-sm font-bold text-[#071426]">
                      {bpkData.keuangan}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#071426] transition-all"
                      style={{
                        width: `${safePercentage(
                          bpkData.keuangan,
                          bpkData.total
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* BUKAN KEUANGAN */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#D4A72C]" />
                      Bukan Keuangan
                    </span>

                    <span className="text-sm font-bold text-[#071426]">
                      {bpkData.bukanKeuangan}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#D4A72C] transition-all"
                      style={{
                        width: `${safePercentage(
                          bpkData.bukanKeuangan,
                          bpkData.total
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    Total BPK
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#071426]">
                    {bpkData.total}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    Keuangan
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#071426]">
                    {bpkData.keuangan}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    Non Keuangan
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#071426]">
                    {bpkData.bukanKeuangan}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* ITJEN */}
        <section className="mb-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F0C85A]">
              Itjen Monitoring
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              Monitoring Tindak Lanjut Itjen
            </h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              {/* STATUS */}

              <div>
                <h3 className="font-bold text-[#071426]">
                  Status Tindak Lanjut
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Distribusi status rekomendasi Itjen
                </p>

                <div className="mt-7 space-y-6">
                  {/* TUNTAS */}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        Sudah Tuntas
                      </span>

                      <span className="text-sm font-bold text-[#071426]">
                        {itjenData.sudahTuntas}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{
                          width: `${persentaseTuntas}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* SUDAH TL */}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Sudah TL
                      </span>

                      <span className="text-sm font-bold text-[#071426]">
                        {itjenData.sudahTl}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{
                          width: `${persentaseSudahTl}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* BELUM TL */}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        Belum TL
                      </span>

                      <span className="text-sm font-bold text-[#071426]">
                        {itjenData.belumTl}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all"
                        style={{
                          width: `${persentaseBelumTl}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* RING */}

              <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6">
                <p className="text-sm font-bold text-[#071426]">
                  Tingkat Penyelesaian
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Rekomendasi Itjen yang sudah tuntas
                </p>

                <div
                  className="relative mt-6 flex h-44 w-44 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(
                      #16A34A ${persentaseTuntas}%,
                      #E2E8F0 ${persentaseTuntas}% 100%
                    )`,
                  }}
                >
                  <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-3xl font-bold text-[#071426]">
                      {persentaseTuntas}%
                    </span>

                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tuntas
                    </span>
                  </div>
                </div>

                <p className="mt-5 text-sm font-semibold text-slate-700">
                  {itjenData.sudahTuntas} dari {itjenData.total} rekomendasi
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* RECENT ACTIVITY */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/95 shadow-xl">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#D4A72C]">
                  Recent Activity
                </p>

                <h2 className="mt-1 font-bold text-[#071426]">
                  Rekomendasi Terbaru
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Data rekomendasi terbaru yang masuk ke sistem
                </p>
              </div>

              <Link
                href="/rekomendasi"
                className="text-sm font-semibold text-[#9B7518] hover:text-[#D4A72C]"
              >
                Lihat Semua →
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#D4A72C]" />

              <p className="mt-3 text-sm text-slate-400">Memuat data...</p>
            </div>
          ) : recentData.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-semibold text-slate-700">
                Belum ada data rekomendasi
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Data akan muncul setelah rekomendasi ditambahkan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      No
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sumber
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      LHA / LHP
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tanggal
                    </th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Rek.
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Belum TL
                    </th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sudah TL
                    </th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sudah Tuntas
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentData.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-bold ${
                            item.source === "BPK"
                              ? "bg-[#071426] text-white"
                              : "bg-[#D4A72C]/15 text-[#8A6810]"
                          }`}
                        >
                          {item.source}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#071426]">
                          {item.lha_number || "-"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {item.category || "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(item.lha_date)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-[#071426]">
                          {safeNumber(item.recommendation_count)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${getSaldoStatusStyle(
                            item.saldo_status
                          )}`}
                        >
                          {getSaldoStatusLabel(item.saldo_status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex min-w-9 justify-center rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                          {item.belumTlCount}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex min-w-9 justify-center rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                          {item.sudahTlCount}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex min-w-9 justify-center rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
                          {item.sudahTuntasCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {/* FOOTER */}
        <div className="py-8 text-center">
          <p className="text-xs text-white/50">
            APF Monitoring Center • Bea Cukai Soekarno-Hatta
          </p>
        </div>
      </div>
    </main>
  );
}
