"use client";

import { useEffect, useMemo, useState } from "react";

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

type Summary = {
  total: number;
  selesai: number;
  proses: number;
  belum: number;
};

export default function ItjenPage() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    selesai: 0,
    proses: 0,
    belum: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* ========================================================= */
  /* LOAD DATA */
  /* ========================================================= */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [recommendationRes, summaryRes] = await Promise.all([
        fetch("/api/recommendations", {
          cache: "no-store",
        }),
        fetch("/api/dashboard/summary", {
          cache: "no-store",
        }),
      ]);

      if (!recommendationRes.ok || !summaryRes.ok) {
        throw new Error("Gagal mengambil data dari server.");
      }

      const recommendationJson = await recommendationRes.json();
      const summaryJson = await summaryRes.json();

      const itjenData = (recommendationJson.data || []).filter(
        (item: Recommendation) => item.source === "ITJEN"
      );

      setData(itjenData);

      if (summaryJson?.data?.itjen) {
        setSummary({
          total: Number(summaryJson.data.itjen.total || 0),
          selesai: Number(summaryJson.data.itjen.selesai || 0),
          proses: Number(summaryJson.data.itjen.proses || 0),
          belum: Number(summaryJson.data.itjen.belum || 0),
        });
      } else {
        /* fallback jika summary Itjen belum tersedia */
        const total = itjenData.reduce(
          (sum: number, item: Recommendation) =>
            sum + Number(item.recommendation_count || 0),
          0
        );

        const selesai = itjenData
          .filter(
            (item: Recommendation) => item.follow_up_status === "SUDAH_TUNTAS"
          )
          .reduce(
            (sum: number, item: Recommendation) =>
              sum + Number(item.recommendation_count || 0),
            0
          );

        const proses = itjenData
          .filter(
            (item: Recommendation) => item.follow_up_status === "BELUM_TUNTAS"
          )
          .reduce(
            (sum: number, item: Recommendation) =>
              sum + Number(item.recommendation_count || 0),
            0
          );

        const belum = itjenData
          .filter(
            (item: Recommendation) => item.follow_up_status === "BELUM_TL"
          )
          .reduce(
            (sum: number, item: Recommendation) =>
              sum + Number(item.recommendation_count || 0),
            0
          );

        setSummary({
          total,
          selesai,
          proses,
          belum,
        });
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError("Data Itjen gagal dimuat. Pastikan API dan database aktif.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* ========================================================= */
  /* FILTER */
  /* ========================================================= */

  const categories = useMemo(() => {
    return Array.from(
      new Set(data.map((item) => item.category).filter(Boolean))
    );
  }, [data]);

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.lha_number.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword) ||
        (item.description || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || item.follow_up_status === statusFilter;

      const matchesCategory =
        categoryFilter === "ALL" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [data, search, statusFilter, categoryFilter]);

  /* ========================================================= */
  /* PERCENTAGE */
  /* ========================================================= */

  const percentage = (value: number) => {
    if (!summary.total) return 0;

    return Math.round((Number(value) / Number(summary.total)) * 100);
  };

  const selesaiPercentage = percentage(summary.selesai);
  const prosesPercentage = percentage(summary.proses);
  const belumPercentage = percentage(summary.belum);

  /* ========================================================= */
  /* FORMAT DATE */
  /* ========================================================= */

  const formatDate = (date: string) => {
    if (!date) return "-";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  /* ========================================================= */
  /* STATUS */
  /* ========================================================= */

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "SUDAH_TUNTAS":
        return "border-green-200 bg-green-50 text-green-700";

      case "BELUM_TUNTAS":
        return "border-amber-200 bg-amber-50 text-amber-700";

      case "BELUM_TL":
        return "border-red-200 bg-red-50 text-red-700";

      default:
        return "border-slate-200 bg-slate-100 text-slate-600";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "SUDAH_TUNTAS":
        return "Sudah Tuntas";

      case "BELUM_TUNTAS":
        return "Belum Tuntas";

      case "BELUM_TL":
        return "Belum TL";

      default:
        return status || "-";
    }
  };

  /* ========================================================= */
  /* TIME */
  /* ========================================================= */

  const getLastUpdated = () => {
    if (!lastUpdated) return "Belum diperbarui";

    return lastUpdated.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-[#F4F7FB] text-slate-800">
      {/* ===================================================== */}
      {/* HERO */}
      {/* ===================================================== */}

      <section className="relative overflow-hidden bg-[#071426]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: "url('/images/gedung-bea-cukai.jpg')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#071426] via-[#071426]/95 to-[#071426]/70" />

        <div className="relative mx-auto max-w-[1600px] px-6 py-9 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              {/* LOGO / SOURCE */}

              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4A72C]/50 bg-[#071426] text-lg font-bold text-[#D4A72C]">
                  I
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D4A72C]">
                    APF Monitoring Center
                  </p>

                  <p className="mt-1 text-xs text-slate-300">
                    Bea Cukai Soekarno-Hatta
                  </p>
                </div>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">
                Monitoring Itjen
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                Monitoring tindak lanjut rekomendasi hasil pemeriksaan
                Inspektorat Jenderal pada Bea Cukai Soekarno-Hatta.
              </p>
            </div>

            {/* HERO ACTION */}

            <div className="flex items-center gap-3">
              <div className="flex h-14 items-center gap-3 rounded-xl border border-slate-700 bg-[#0b1b30]/80 px-5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />

                <div>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500">
                    System Status
                  </p>

                  <p className="text-sm font-semibold text-white">Online</p>
                </div>
              </div>

              <button
                onClick={loadData}
                disabled={loading}
                className="flex h-14 items-center gap-2 rounded-xl bg-[#D4A72C] px-5 text-sm font-bold text-[#071426] shadow-lg transition hover:bg-[#e5ba45] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h5M20 20v-5h-5M5.64 9A7 7 0 0118.36 6M18.36 15A7 7 0 015.64 18"
                  />
                </svg>
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* MAIN */}
      {/* ===================================================== */}

      <div className="mx-auto max-w-[1600px] space-y-7 px-6 py-8 lg:px-10">
        {/* ERROR */}

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
                !
              </div>

              <div>
                <p className="text-sm font-semibold text-red-700">
                  Terjadi masalah
                </p>

                <p className="text-xs text-red-500">{error}</p>
              </div>
            </div>

            <button
              onClick={loadData}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* =================================================== */}
        {/* KPI */}
        {/* =================================================== */}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {/* TOTAL */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B84A8]">
                  Total Rekomendasi
                </p>

                <p className="mt-3 text-4xl font-bold text-[#071426]">
                  {summary.total}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#071426] text-sm font-bold text-white shadow-lg">
                ITJEN
              </div>
            </div>

            <div className="mt-7 flex items-center justify-between text-xs">
              <span className="text-slate-400">Seluruh rekomendasi</span>

              <span className="font-bold text-[#071426]">2026</span>
            </div>
          </div>

          {/* SUDAH TUNTAS */}

          <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-white to-green-50/40 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B84A8]">
                  Sudah Tuntas
                </p>

                <p className="mt-3 text-4xl font-bold text-green-600">
                  {summary.selesai}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs">
              <span className="text-slate-400">Capaian</span>

              <span className="font-bold text-green-600">
                {selesaiPercentage}%
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-green-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-700"
                style={{
                  width: `${selesaiPercentage}%`,
                }}
              />
            </div>
          </div>

          {/* BELUM TUNTAS */}

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/40 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B84A8]">
                  Belum Tuntas
                </p>

                <p className="mt-3 text-4xl font-bold text-amber-600">
                  {summary.proses}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs">
              <span className="text-slate-400">Perlu ditindaklanjuti</span>

              <span className="font-bold text-amber-600">
                {prosesPercentage}%
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-700"
                style={{
                  width: `${prosesPercentage}%`,
                }}
              />
            </div>
          </div>

          {/* CAPAIAN */}

          <div className="rounded-2xl border border-[#D4A72C]/20 bg-gradient-to-br from-white to-[#D4A72C]/5 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B84A8]">
                  Capaian Penyelesaian
                </p>

                <p className="mt-3 text-4xl font-bold text-[#9A7414]">
                  {selesaiPercentage}%
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A72C]/10 text-[#9A7414]">
                %
              </div>
            </div>

            <div className="mt-7 flex items-center gap-2">
              <span className="rounded-full bg-[#D4A72C]/10 px-3 py-1 text-[10px] font-bold text-[#9A7414]">
                ITJEN
              </span>

              <span className="text-xs text-slate-400">
                Persentase penyelesaian
              </span>
            </div>
          </div>
        </section>

        {/* =================================================== */}
        {/* ANALYTICS */}
        {/* =================================================== */}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ANALISIS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />

                  <h2 className="text-lg font-bold text-[#071426]">
                    Analisis Status Tindak Lanjut
                  </h2>
                </div>

                <p className="mt-1 text-sm text-[#6B84A8]">
                  Distribusi rekomendasi berdasarkan status tindak lanjut
                </p>
              </div>

              <span className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                DATA ITJEN
              </span>
            </div>

            {/* PROGRESS */}

            <div className="mt-8 space-y-6">
              {/* TUNTAS */}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-green-500" />

                    <span className="text-sm font-semibold text-slate-700">
                      Sudah Tuntas
                    </span>
                  </div>

                  <span className="text-sm font-bold text-slate-800">
                    {summary.selesai}
                    <span className="ml-1 font-normal text-slate-400">
                      ({selesaiPercentage}%)
                    </span>
                  </span>
                </div>

                <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-700"
                    style={{
                      width: `${selesaiPercentage}%`,
                    }}
                  />
                </div>
              </div>

              {/* PROSES */}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-amber-500" />

                    <span className="text-sm font-semibold text-slate-700">
                      Belum Tuntas
                    </span>
                  </div>

                  <span className="text-sm font-bold text-slate-800">
                    {summary.proses}
                    <span className="ml-1 font-normal text-slate-400">
                      ({prosesPercentage}%)
                    </span>
                  </span>
                </div>

                <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-700"
                    style={{
                      width: `${prosesPercentage}%`,
                    }}
                  />
                </div>
              </div>

              {/* BELUM TL */}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-red-500" />

                    <span className="text-sm font-semibold text-slate-700">
                      Belum TL
                    </span>
                  </div>

                  <span className="text-sm font-bold text-slate-800">
                    {summary.belum}
                    <span className="ml-1 font-normal text-slate-400">
                      ({belumPercentage}%)
                    </span>
                  </span>
                </div>

                <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all duration-700"
                    style={{
                      width: `${belumPercentage}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* MINI SUMMARY */}

            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-xs text-green-600">Tuntas</p>

                <p className="mt-1 text-xl font-bold text-green-700">
                  {summary.selesai}
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs text-amber-600">Proses</p>

                <p className="mt-1 text-xl font-bold text-amber-700">
                  {summary.proses}
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-xs text-red-600">Belum TL</p>

                <p className="mt-1 text-xl font-bold text-red-700">
                  {summary.belum}
                </p>
              </div>
            </div>
          </div>

          {/* CLASSIFICATION */}

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />

                  <h2 className="text-lg font-bold text-[#071426]">
                    Klasifikasi Pemeriksaan
                  </h2>
                </div>

                <p className="mt-1 text-sm text-[#6B84A8]">
                  Distribusi kategori pemeriksaan Itjen
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              {categories.length > 0 ? (
                categories.map((category) => {
                  const categoryTotal = data
                    .filter((item) => item.category === category)
                    .reduce(
                      (sum, item) =>
                        sum + Number(item.recommendation_count || 0),
                      0
                    );

                  const categoryPercentage =
                    summary.total > 0
                      ? Math.round((categoryTotal / summary.total) * 100)
                      : 0;

                  return (
                    <div key={category}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-700">
                          {category}
                        </span>

                        <span className="text-sm font-bold text-[#071426]">
                          {categoryTotal}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#D4A72C] transition-all duration-700"
                          style={{
                            width: `${categoryPercentage}%`,
                          }}
                        />
                      </div>

                      <p className="mt-1 text-right text-[10px] text-slate-400">
                        {categoryPercentage}% dari total
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl bg-slate-50 p-6 text-center">
                  <p className="text-sm font-medium text-slate-500">
                    Belum ada klasifikasi
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Data kategori pemeriksaan akan tampil di sini.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 rounded-xl bg-[#071426] p-5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Sumber Pemeriksaan
              </p>

              <p className="mt-1 text-sm font-semibold text-white">
                Inspektorat Jenderal
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Monitoring tindak lanjut rekomendasi pemeriksaan Itjen Bea Cukai
                Soekarno-Hatta.
              </p>
            </div>
          </div>
        </section>

        {/* =================================================== */}
        {/* TABLE */}
        {/* =================================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* TABLE HEADER */}

          <div className="border-b border-slate-200 px-6 py-6 lg:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4A72C]">
                    Data Pemeriksaan
                  </p>

                  <span className="rounded-full bg-[#071426] px-2.5 py-1 text-[10px] font-bold text-white">
                    {filteredData.length}
                  </span>
                </div>

                <h2 className="mt-1 text-xl font-bold text-[#071426]">
                  Daftar Rekomendasi Itjen
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Seluruh rekomendasi hasil pemeriksaan Inspektorat Jenderal.
                </p>
              </div>

              {/* FILTERS */}

              <div className="flex flex-col gap-3 md:flex-row">
                {/* SEARCH */}

                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35m2.1-5.4a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
                    />
                  </svg>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari data..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#D4A72C] focus:bg-white focus:ring-2 focus:ring-[#D4A72C]/10 md:w-56"
                  />
                </div>

                {/* STATUS */}

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 outline-none transition focus:border-[#D4A72C] focus:bg-white"
                >
                  <option value="ALL">Semua Status</option>

                  <option value="SUDAH_TUNTAS">Sudah Tuntas</option>

                  <option value="BELUM_TUNTAS">Belum Tuntas</option>

                  <option value="BELUM_TL">Belum TL</option>
                </select>

                {/* CATEGORY */}

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 outline-none transition focus:border-[#D4A72C] focus:bg-white"
                >
                  <option value="ALL">Semua Kategori</option>

                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TABLE BODY */}

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#D4A72C]" />
                  Memuat data Itjen...
                </div>
              </div>
            ) : error ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-xl font-bold text-red-500">
                  !
                </div>

                <p className="mt-4 font-semibold text-slate-700">
                  Data gagal dimuat
                </p>

                <p className="mt-1 max-w-md text-sm text-slate-400">{error}</p>

                <button
                  onClick={loadData}
                  className="mt-5 rounded-xl bg-[#071426] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#10243e]"
                >
                  Coba Lagi
                </button>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6m-3-3v6m8-3a8 8 0 11-16 0 8 8 0 0116 0z"
                    />
                  </svg>
                </div>

                <p className="mt-4 font-semibold text-slate-700">
                  Tidak ada data ditemukan
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Coba ubah kata pencarian atau filter.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      No
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Nomor LHA
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tanggal
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Kategori
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Rekomendasi
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tindak Lanjut
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status Saldo
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      className="group transition hover:bg-slate-50/80"
                    >
                      {/* NO */}

                      <td className="px-6 py-5 text-sm font-medium text-slate-400">
                        {index + 1}
                      </td>

                      {/* LHA */}

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071426] text-xs font-bold text-[#D4A72C]">
                            I
                          </div>

                          <div>
                            <p className="font-semibold text-[#071426]">
                              {item.lha_number}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              ID #{item.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* DATE */}

                      <td className="px-6 py-5 text-sm text-slate-600">
                        {formatDate(item.lha_date)}
                      </td>

                      {/* CATEGORY */}

                      <td className="px-6 py-5">
                        <span className="inline-flex max-w-[200px] rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                          {item.category}
                        </span>
                      </td>

                      {/* COUNT */}

                      <td className="px-6 py-5">
                        <span className="font-bold text-[#071426]">
                          {item.recommendation_count}
                        </span>

                        <span className="ml-1 text-xs text-slate-400">
                          rekomendasi
                        </span>
                      </td>

                      {/* FOLLOW UP */}

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusStyle(
                            item.follow_up_status
                          )}`}
                        >
                          {getStatusLabel(item.follow_up_status)}
                        </span>
                      </td>

                      {/* SALDO */}

                      <td className="px-6 py-5">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                          {item.saldo_status || "-"}
                        </span>
                      </td>

                      {/* ACTION */}

                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => setSelected(item)}
                          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#D4A72C] hover:bg-[#D4A72C]/5 hover:text-[#9A7414]"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* TABLE FOOTER */}

          {!loading && !error && (
            <div className="flex flex-col gap-2 border-t border-slate-200 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Menampilkan{" "}
                <span className="font-semibold text-slate-600">
                  {filteredData.length}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-slate-600">
                  {data.length}
                </span>{" "}
                data rekomendasi
              </span>

              <span>Terakhir diperbarui {getLastUpdated()}</span>
            </div>
          )}
        </section>
      </div>

      {/* ===================================================== */}
      {/* DETAIL DRAWER */}
      {/* ===================================================== */}

      {selected && (
        <div className="fixed inset-0 z-[100]">
          {/* BACKDROP */}

          <div
            className="absolute inset-0 bg-[#071426]/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          {/* DRAWER */}

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            {/* DRAWER HEADER */}

            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4A72C]">
                    Detail Pemeriksaan Itjen
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#071426]">
                    {selected.lha_number}
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    ID #{selected.id}
                  </p>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* DRAWER CONTENT */}

            <div className="space-y-6 p-6">
              {/* HERO */}

              <div className="overflow-hidden rounded-2xl bg-[#071426] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      Jumlah Rekomendasi
                    </p>

                    <p className="mt-2 text-4xl font-bold text-white">
                      {selected.recommendation_count}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      rekomendasi pemeriksaan
                    </p>
                  </div>

                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4A72C]/30 bg-[#D4A72C]/10 text-xl font-bold text-[#D4A72C]">
                    ITJEN
                  </div>
                </div>
              </div>

              {/* STATUS */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Status Tindak Lanjut
                  </p>

                  <div className="mt-3">
                    <span
                      className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${getStatusStyle(
                        selected.follow_up_status
                      )}`}
                    >
                      {getStatusLabel(selected.follow_up_status)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Status Saldo
                  </p>

                  <div className="mt-3">
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                      {selected.saldo_status || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* INFORMATION */}

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h3 className="font-semibold text-[#071426]">
                    Informasi Pemeriksaan
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  <div className="flex items-start justify-between gap-5 px-5 py-4">
                    <span className="text-sm text-slate-400">
                      Sumber Pemeriksaan
                    </span>

                    <span className="text-right text-sm font-semibold text-slate-700">
                      Inspektorat Jenderal
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-5 px-5 py-4">
                    <span className="text-sm text-slate-400">Nomor LHA</span>

                    <span className="text-right text-sm font-semibold text-slate-700">
                      {selected.lha_number}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-5 px-5 py-4">
                    <span className="text-sm text-slate-400">Tanggal LHA</span>

                    <span className="text-right text-sm font-semibold text-slate-700">
                      {formatDate(selected.lha_date)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-5 px-5 py-4">
                    <span className="text-sm text-slate-400">Kategori</span>

                    <span className="text-right text-sm font-semibold text-slate-700">
                      {selected.category}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-5 px-5 py-4">
                    <span className="text-sm text-slate-400">
                      Jumlah Rekomendasi
                    </span>

                    <span className="text-right text-sm font-semibold text-slate-700">
                      {selected.recommendation_count}
                    </span>
                  </div>
                </div>
              </div>

              {/* DESCRIPTION */}

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h3 className="font-semibold text-[#071426]">
                    Uraian / Keterangan
                  </h3>
                </div>

                <div className="p-5">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {selected.description || "Tidak ada keterangan."}
                  </p>
                </div>
              </div>
            </div>

            {/* DRAWER FOOTER */}

            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-5">
              <button
                onClick={() => setSelected(null)}
                className="w-full rounded-xl bg-[#071426] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#10243e]"
              >
                Tutup Detail
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
