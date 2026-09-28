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
  created_at?: string;
};

type Summary = {
  total: number;
  masukSaldo: number;
  belumSaldo: number;
  keuangan: number;
  bukanKeuangan: number;
  persentaseSaldo: number;
};

export default function BpkPage() {
  const [data, setData] = useState<Recommendation[]>([]);

  const [summary, setSummary] = useState<Summary>({
    total: 0,
    masukSaldo: 0,
    belumSaldo: 0,
    keuangan: 0,
    bukanKeuangan: 0,
    persentaseSaldo: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [selected, setSelected] = useState<Recommendation | null>(null);

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
        throw new Error("Gagal mengambil data");
      }

      const recommendationJson = await recommendationRes.json();
      const summaryJson = await summaryRes.json();

      const bpkData = (recommendationJson.data || []).filter(
        (item: Recommendation) => item.source === "BPK"
      );

      setData(bpkData);

      if (summaryJson?.data?.bpk) {
        setSummary(summaryJson.data.bpk);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError("Data BPK gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.lha_number.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword) ||
        (item.description || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || item.saldo_status === statusFilter;

      const matchesCategory =
        categoryFilter === "ALL" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [data, search, statusFilter, categoryFilter]);

  const saldoPercentage =
    summary.total > 0
      ? Math.round((summary.masukSaldo / summary.total) * 100)
      : 0;

  const belumSaldoPercentage =
    summary.total > 0
      ? Math.round((summary.belumSaldo / summary.total) * 100)
      : 0;

  const keuanganPercentage =
    summary.total > 0
      ? Math.round((summary.keuangan / summary.total) * 100)
      : 0;

  const bukanKeuanganPercentage =
    summary.total > 0
      ? Math.round((summary.bukanKeuangan / summary.total) * 100)
      : 0;

  const formatDate = (date: string) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatShortDate = (date: Date | null) => {
    if (!date) return "-";

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "MASUK_SALDO":
        return "border-green-200 bg-green-50 text-green-700";

      case "BELUM_SALDO":
        return "border-amber-200 bg-amber-50 text-amber-700";

      case "TIDAK_RELEVAN":
        return "border-slate-200 bg-slate-100 text-slate-600";

      default:
        return "border-slate-200 bg-slate-100 text-slate-600";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "MASUK_SALDO":
        return "Masuk Saldo";

      case "BELUM_SALDO":
        return "Belum Saldo";

      case "TIDAK_RELEVAN":
        return "Tidak Relevan";

      default:
        return status;
    }
  };

  const getFollowUpStyle = (status: string) => {
    switch (status) {
      case "SUDAH_TUNTAS":
        return "bg-green-50 text-green-700 border-green-200";

      case "BELUM_TUNTAS":
        return "bg-amber-50 text-amber-700 border-amber-200";

      case "BELUM_TL":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getFollowUpLabel = (status: string) => {
    switch (status) {
      case "SUDAH_TUNTAS":
        return "Sudah Tuntas";

      case "BELUM_TUNTAS":
        return "Belum Tuntas";

      case "BELUM_TL":
        return "Belum TL";

      default:
        return status.replaceAll("_", " ");
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F7FB]">
      {/* TOP HEADER */}
      <section className="relative overflow-hidden bg-[#071426] px-6 py-8 lg:px-10">
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-[#D4A72C]/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1600px]">
          <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4A72C]/30 bg-[#D4A72C]/10 text-lg font-bold text-[#D4A72C]">
                  B
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4A72C]">
                    APF Monitoring Center
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Bea Cukai Soekarno-Hatta
                  </p>
                </div>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Monitoring BPK
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Monitoring tindak lanjut dan status saldo rekomendasi hasil
                pemeriksaan Badan Pemeriksa Keuangan.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    System Status
                  </p>

                  <p className="text-xs font-semibold text-white">Online</p>
                </div>
              </div>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D4A72C]/40 bg-[#D4A72C] px-5 py-3 text-sm font-bold text-[#071426] shadow-lg shadow-black/10 transition hover:bg-[#e5ba45] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={loading ? "animate-spin" : ""}>↻</span>
                {loading ? "Memuat..." : "Refresh Data"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        {/* ERROR */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-red-700">
                Terjadi Kesalahan
              </p>

              <p className="mt-1 text-xs text-red-600">{error}</p>
            </div>

            <button
              onClick={loadData}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* KPI CARDS */}
        <section className="mb-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {/* TOTAL */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#071426]/5 blur-2xl transition group-hover:bg-[#071426]/10" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Total Rekomendasi
                  </p>

                  <p className="mt-3 text-4xl font-bold tracking-tight text-[#071426]">
                    {summary.total}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#071426] text-lg font-bold text-white shadow-lg shadow-[#071426]/20">
                  BPK
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-400">
                  Seluruh rekomendasi
                </span>

                <span className="text-xs font-bold text-[#071426]">2026</span>
              </div>
            </div>
          </div>

          {/* MASUK SALDO */}
          <div className="group relative overflow-hidden rounded-2xl border border-green-100 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-green-100 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Masuk Saldo
                  </p>

                  <p className="mt-3 text-4xl font-bold text-green-600">
                    {summary.masukSaldo}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-xl text-green-600">
                  ✓
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-[11px]">
                  <span className="text-slate-400">Capaian</span>
                  <span className="font-bold text-green-600">
                    {saldoPercentage}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-green-100">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-700"
                    style={{ width: `${saldoPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BELUM SALDO */}
          <div className="group relative overflow-hidden rounded-2xl border border-amber-100 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-amber-100 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Belum Saldo
                  </p>

                  <p className="mt-3 text-4xl font-bold text-amber-600">
                    {summary.belumSaldo}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-600">
                  !
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-[11px]">
                  <span className="text-slate-400">Perlu monitoring</span>
                  <span className="font-bold text-amber-600">
                    {belumSaldoPercentage}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-700"
                    style={{ width: `${belumSaldoPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CAPAIAN */}
          <div className="group relative overflow-hidden rounded-2xl border border-[#D4A72C]/20 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#D4A72C]/10 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Capaian Saldo
                  </p>

                  <p className="mt-3 text-4xl font-bold text-[#9B7518]">
                    {saldoPercentage}%
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A72C]/10 text-lg font-bold text-[#9B7518]">
                  %
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-full bg-[#D4A72C]/10 px-2.5 py-1 text-[10px] font-bold text-[#9B7518]">
                  BPK
                </span>

                <span className="text-[11px] text-slate-400">
                  Persentase saldo
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN ANALYTICS */}
        <section className="mb-7 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          {/* SALDO ANALYTICS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />

                  <h2 className="font-bold text-[#071426]">
                    Analisis Status Saldo
                  </h2>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  Distribusi rekomendasi berdasarkan status saldo
                </p>
              </div>

              <span className="w-fit rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Data BPK
              </span>
            </div>

            <div className="flex flex-col items-center gap-10 md:flex-row">
              {/* DONUT */}
              <div className="relative flex h-56 w-56 shrink-0 items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full transition-all duration-700"
                  style={{
                    background: `conic-gradient(
                      #16A34A 0% ${saldoPercentage}%,
                      #F59E0B ${saldoPercentage}% 100%
                    )`,
                  }}
                />

                <div className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                  <span className="text-4xl font-bold text-[#071426]">
                    {saldoPercentage}%
                  </span>

                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Saldo
                  </span>

                  <span className="mt-2 text-[10px] text-slate-400">
                    dari {summary.total} rekomendasi
                  </span>
                </div>
              </div>

              {/* LEGEND */}
              <div className="w-full space-y-6">
                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full bg-green-500" />

                      <span className="text-sm font-bold text-slate-700">
                        Masuk Saldo
                      </span>
                    </div>

                    <span className="text-xl font-bold text-green-600">
                      {summary.masukSaldo}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-green-100">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-700"
                      style={{ width: `${saldoPercentage}%` }}
                    />
                  </div>

                  <p className="mt-2 text-[11px] text-green-700">
                    {saldoPercentage}% dari seluruh rekomendasi BPK
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full bg-amber-500" />

                      <span className="text-sm font-bold text-slate-700">
                        Belum Saldo
                      </span>
                    </div>

                    <span className="text-xl font-bold text-amber-600">
                      {summary.belumSaldo}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-700"
                      style={{ width: `${belumSaldoPercentage}%` }}
                    />
                  </div>

                  <p className="mt-2 text-[11px] text-amber-700">
                    {belumSaldoPercentage}% memerlukan pemantauan
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CLASSIFICATION */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-7">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />

                <h2 className="font-bold text-[#071426]">
                  Klasifikasi Pemeriksaan
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                Distribusi kategori pemeriksaan BPK
              </p>
            </div>

            <div className="space-y-7">
              <div>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      Laporan Keuangan
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Pemeriksaan laporan keuangan
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-[#071426]">
                      {summary.keuangan}
                    </p>

                    <p className="text-[10px] font-semibold text-slate-400">
                      {keuanganPercentage}%
                    </p>
                  </div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#071426] transition-all duration-700"
                    style={{ width: `${keuanganPercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      Bukan Keuangan
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Pemeriksaan non-keuangan
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-[#9B7518]">
                      {summary.bukanKeuangan}
                    </p>

                    <p className="text-[10px] font-semibold text-slate-400">
                      {bukanKeuanganPercentage}%
                    </p>
                  </div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#D4A72C] transition-all duration-700"
                    style={{ width: `${bukanKeuanganPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-[#071426] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Total Kategori
                  </p>

                  <p className="mt-1 text-lg font-bold text-white">
                    {summary.keuangan + summary.bukanKeuangan}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Sumber
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#D4A72C]">BPK</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DATA TABLE */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* TABLE HEADER */}
          <div className="border-b border-slate-100 px-6 py-6">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-[#071426]">
                    Daftar Rekomendasi BPK
                  </h2>

                  <span className="rounded-full bg-[#071426] px-2.5 py-1 text-[10px] font-bold text-white">
                    {filteredData.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  Data rekomendasi yang tersimpan dalam sistem APF
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row">
                {/* SEARCH */}
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>

                  <input
                    type="text"
                    placeholder="Cari nomor LHA..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#D4A72C] focus:bg-white focus:ring-2 focus:ring-[#D4A72C]/10 md:w-56"
                  />
                </div>

                {/* STATUS */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-[#D4A72C] focus:bg-white"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="MASUK_SALDO">Masuk Saldo</option>
                  <option value="BELUM_SALDO">Belum Saldo</option>
                  <option value="TIDAK_RELEVAN">Tidak Relevan</option>
                </select>

                {/* CATEGORY */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-[#D4A72C] focus:bg-white"
                >
                  <option value="ALL">Semua Kategori</option>
                  <option value="Laporan Keuangan">Laporan Keuangan</option>
                  <option value="Bukan Keuangan">Bukan Keuangan</option>
                  <option value="Tindak Lanjut Pemeriksaan">
                    Tindak Lanjut Pemeriksaan
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* LOADING */}
          {loading ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#071426]">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-white/20 border-t-[#D4A72C]" />
              </div>

              <p className="font-semibold text-slate-700">Memuat data BPK</p>

              <p className="mt-1 text-xs text-slate-400">
                Mengambil data terbaru dari server...
              </p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                ⌕
              </div>

              <p className="font-semibold text-slate-700">
                Tidak ada data ditemukan
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Coba ubah kata pencarian atau filter.
              </p>

              {(search ||
                statusFilter !== "ALL" ||
                categoryFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setCategoryFilter("ALL");
                  }}
                  className="mt-5 rounded-xl bg-[#071426] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#10233d]"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      No
                    </th>

                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      LHA / LHP
                    </th>

                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tanggal
                    </th>

                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Kategori
                    </th>

                    <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Rekomendasi
                    </th>

                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tindak Lanjut
                    </th>

                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Status Saldo
                    </th>

                    <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      className="group border-b border-slate-100 last:border-0 transition hover:bg-[#F8FAFC]"
                    >
                      <td className="px-6 py-5">
                        <span className="text-xs font-semibold text-slate-400">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071426] text-xs font-bold text-[#D4A72C]">
                            BPK
                          </div>

                          <div>
                            <p className="font-bold text-[#071426]">
                              {item.lha_number}
                            </p>

                            {item.description && (
                              <p className="mt-1 max-w-xs truncate text-[11px] text-slate-400">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-sm font-medium text-slate-600">
                          {formatDate(item.lha_date)}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                          {item.category}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#071426] px-3 text-sm font-bold text-white">
                          {item.recommendation_count}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-lg border px-3 py-1.5 text-[10px] font-bold ${getFollowUpStyle(
                            item.follow_up_status
                          )}`}
                        >
                          {getFollowUpLabel(item.follow_up_status)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-lg border px-3 py-1.5 text-[10px] font-bold ${getStatusStyle(
                            item.saldo_status
                          )}`}
                        >
                          {getStatusLabel(item.saldo_status)}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => setSelected(item)}
                          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-[#D4A72C] hover:bg-[#D4A72C]/5 hover:text-[#9B7518]"
                        >
                          Detail →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* FOOTER */}
          <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center">
            <p className="text-[11px] text-slate-400">
              Menampilkan{" "}
              <span className="font-bold text-slate-600">
                {filteredData.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-slate-600">{data.length}</span>{" "}
              data BPK
            </p>

            <p className="text-[11px] text-slate-400">
              Terakhir diperbarui{" "}
              <span className="font-semibold text-slate-600">
                {formatShortDate(lastUpdated)}
              </span>
            </p>
          </div>
        </section>
      </div>

      {/* DETAIL DRAWER */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* BACKDROP */}
          <div
            className="absolute inset-0 bg-[#071426]/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          {/* DRAWER */}
          <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-[#F8FAFC] shadow-2xl">
            {/* DRAWER HEADER */}
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />

                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9B7518]">
                      Detail Pemeriksaan BPK
                    </span>
                  </div>

                  <h2 className="mt-2 text-2xl font-bold text-[#071426]">
                    {selected.lha_number}
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    ID Rekomendasi #{selected.id}
                  </p>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 hover:text-[#071426]"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {/* HERO */}
              <div className="relative overflow-hidden rounded-2xl bg-[#071426] p-6 text-white">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#D4A72C]/10 blur-2xl" />

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Jumlah Rekomendasi
                      </p>

                      <p className="mt-2 text-5xl font-bold text-white">
                        {selected.recommendation_count}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#D4A72C]/30 bg-[#D4A72C]/10 px-3 py-2 text-[10px] font-bold text-[#D4A72C]">
                      BPK
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    Rekomendasi pada dokumen pemeriksaan.
                  </p>
                </div>
              </div>

              {/* STATUS */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Status Saldo
                  </p>

                  <div className="mt-3">
                    <span
                      className={`inline-flex rounded-lg border px-3 py-2 text-xs font-bold ${getStatusStyle(
                        selected.saldo_status
                      )}`}
                    >
                      {getStatusLabel(selected.saldo_status)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tindak Lanjut
                  </p>

                  <div className="mt-3">
                    <span
                      className={`inline-flex rounded-lg border px-3 py-2 text-xs font-bold ${getFollowUpStyle(
                        selected.follow_up_status
                      )}`}
                    >
                      {getFollowUpLabel(selected.follow_up_status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* INFORMATION */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Informasi Pemeriksaan
                </p>

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4">
                    <span className="text-xs text-slate-400">
                      Nomor LHA / LHP
                    </span>

                    <span className="text-right text-sm font-bold text-[#071426]">
                      {selected.lha_number}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4">
                    <span className="text-xs text-slate-400">
                      Tanggal Pemeriksaan
                    </span>

                    <span className="text-right text-sm font-semibold text-slate-700">
                      {formatDate(selected.lha_date)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4">
                    <span className="text-xs text-slate-400">Kategori</span>

                    <span className="text-right text-sm font-semibold text-slate-700">
                      {selected.category}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-5">
                    <span className="text-xs text-slate-400">
                      Sumber Pemeriksaan
                    </span>

                    <span className="rounded-lg bg-[#071426] px-3 py-1.5 text-xs font-bold text-white">
                      {selected.source}
                    </span>
                  </div>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Keterangan
                </p>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm leading-7 text-slate-600">
                    {selected.description || "Tidak ada keterangan."}
                  </p>
                </div>
              </div>

              {/* CLOSE */}
              <button
                onClick={() => setSelected(null)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
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
