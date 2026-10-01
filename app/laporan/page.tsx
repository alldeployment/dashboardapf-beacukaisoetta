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
  no_temuan?: string | null;
  judul?: string | null;
  rencana_aksi?: string | null;
  keterangan_bukti_dukung?: string | null;
  waktu_pelaksanaan?: string | null;
  uic?: string | null;
  tindak_lanjut?: string | null;
};

export default function LaporanPage() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Recommendation | null>(null);

  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/recommendations", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Gagal mengambil data");
      }

      const json = await response.json();

      setData(json.data || []);
    } catch (err) {
      console.error(err);
      setError("Data laporan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================
  // FILTER DATA
  // =========================================================

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const itemDate = item.lha_date ? item.lha_date.substring(0, 10) : "";

      const matchesDate =
        (!startDate || itemDate >= startDate) &&
        (!endDate || itemDate <= endDate);

      const matchesSource =
        sourceFilter === "ALL" || item.source === sourceFilter;

      const normalizedStatus =
        item.follow_up_status === "BELUM_TUNTAS"
          ? "SUDAH_TL"
          : item.follow_up_status;

      const matchesStatus =
        statusFilter === "ALL" || normalizedStatus === statusFilter;

      const matchesCategory =
        categoryFilter === "ALL" || item.category === categoryFilter;

      const matchesSearch =
        !keyword ||
        item.lha_number.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword) ||
        item.source.toLowerCase().includes(keyword) ||
        (item.description || "").toLowerCase().includes(keyword) ||
        (item.no_temuan || "").toLowerCase().includes(keyword) ||
        (item.judul || "").toLowerCase().includes(keyword) ||
        (item.rencana_aksi || "").toLowerCase().includes(keyword) ||
        (item.keterangan_bukti_dukung || "").toLowerCase().includes(keyword) ||
        (item.uic || "").toLowerCase().includes(keyword) ||
        (item.tindak_lanjut || "").toLowerCase().includes(keyword);

      return (
        matchesDate &&
        matchesSource &&
        matchesStatus &&
        matchesCategory &&
        matchesSearch
      );
    });
  }, [
    data,
    startDate,
    endDate,
    sourceFilter,
    statusFilter,
    categoryFilter,
    search,
  ]);

  // =========================================================
  // REKAP
  // =========================================================

  const total = useMemo(
    () =>
      filteredData.reduce(
        (sum, item) => sum + Number(item.recommendation_count),
        0
      ),
    [filteredData]
  );

  const masukSaldo = useMemo(
    () =>
      filteredData
        .filter((item) => item.saldo_status === "MASUK_SALDO")
        .reduce((sum, item) => sum + Number(item.recommendation_count), 0),
    [filteredData]
  );

  const belumSaldo = useMemo(
    () =>
      filteredData
        .filter((item) => item.saldo_status === "BELUM_SALDO")
        .reduce((sum, item) => sum + Number(item.recommendation_count), 0),
    [filteredData]
  );

  const belumTl = useMemo(
    () =>
      filteredData
        .filter((item) => item.follow_up_status === "BELUM_TL")
        .reduce((sum, item) => sum + Number(item.recommendation_count), 0),
    [filteredData]
  );

  const sudahTl = useMemo(
    () =>
      filteredData
        .filter(
          (item) =>
            item.follow_up_status === "SUDAH_TL" ||
            item.follow_up_status === "BELUM_TUNTAS"
        )
        .reduce((sum, item) => sum + Number(item.recommendation_count), 0),
    [filteredData]
  );

  const sudahTuntas = useMemo(
    () =>
      filteredData
        .filter((item) => item.follow_up_status === "SUDAH_TUNTAS")
        .reduce((sum, item) => sum + Number(item.recommendation_count), 0),
    [filteredData]
  );

  const bpkTotal = useMemo(
    () =>
      filteredData
        .filter((item) => item.source === "BPK")
        .reduce((sum, item) => sum + Number(item.recommendation_count), 0),
    [filteredData]
  );

  const itjenTotal = useMemo(
    () =>
      filteredData
        .filter((item) => item.source === "ITJEN")
        .reduce((sum, item) => sum + Number(item.recommendation_count), 0),
    [filteredData]
  );

  const persentaseSaldo =
    total > 0 ? Math.round((masukSaldo / total) * 100) : 0;

  const persentaseTuntas =
    total > 0 ? Math.round((sudahTuntas / total) * 100) : 0;

  const persentaseSudahTl = total > 0 ? Math.round((sudahTl / total) * 100) : 0;

  const persentaseBelumTl = total > 0 ? Math.round((belumTl / total) * 100) : 0;

  // =========================================================
  // HELPER
  // =========================================================

  const formatDate = (date: string) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusStyle = (status: string) => {
    const normalizedStatus = status === "BELUM_TUNTAS" ? "SUDAH_TL" : status;

    switch (normalizedStatus) {
      case "SUDAH_TUNTAS":
        return "border-green-200 bg-green-50 text-green-700";

      case "SUDAH_TL":
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

      case "SUDAH_TL":
        return "Sudah TL";

      case "BELUM_TUNTAS":
        return "Sudah TL";

      case "BELUM_TL":
        return "Belum TL";

      default:
        return status;
    }
  };

  const getSaldoLabel = (status: string) => {
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

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const exportExcel = () => {
    const params = new URLSearchParams();

    if (startDate) {
      params.set("startDate", startDate);
    }

    if (endDate) {
      params.set("endDate", endDate);
    }

    if (sourceFilter !== "ALL") {
      params.set("source", sourceFilter);
    }

    if (statusFilter !== "ALL") {
      params.set("followUpStatus", statusFilter);
    }

    if (categoryFilter !== "ALL") {
      params.set("category", categoryFilter);
    }

    const query = params.toString();

    window.location.href = query
      ? `/api/recommendations/export?${query}`
      : "/api/recommendations/export";
  };

  // =========================================================
  // RESET FILTER
  // =========================================================

  const resetFilter = () => {
    setStartDate("");
    setEndDate("");
    setSourceFilter("ALL");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setSearch("");
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="min-h-screen bg-[#F4F7FB] px-6 py-5 lg:px-8">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="mb-5">
        <div className="relative overflow-hidden rounded-2xl bg-[#071B41] px-5 py-6 text-white shadow-sm sm:px-7">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1">
                <span className="text-[10px] font-semibold text-white">
                  Monitoring APP
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Laporan APF
              </h1>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-blue-100 sm:text-sm">
                Rekapitulasi data rekomendasi hasil pemeriksaan BPK dan Itjen
                pada KPUBC Tipe C Soekarno-Hatta.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={exportExcel}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <span className="text-sm">↓</span>
                Export Excel
              </button>

              <button
                onClick={loadData}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[#071B41] transition hover:bg-slate-100"
              >
                <span className="text-sm">↻</span>
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          FILTER
      ===================================================== */}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF3FA] text-sm">
                🔎
              </span>

              <div>
                <h2 className="text-sm font-bold text-[#071426]">
                  Filter Laporan
                </h2>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  Gunakan filter untuk menampilkan data tertentu.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={resetFilter}
            className="text-xs font-semibold text-slate-500 transition hover:text-[#9B7518]"
          >
            Reset Filter
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {/* TANGGAL MULAI */}

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-slate-600">
              Tanggal Mulai
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ colorScheme: "light" }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-black outline-none transition focus:border-[#D4A72C] focus:bg-white"
            />
          </div>

          {/* TANGGAL AKHIR */}

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-slate-600">
              Tanggal Akhir
            </label>

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ colorScheme: "light" }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-black outline-none transition focus:border-[#D4A72C] focus:bg-white"
            />
          </div>

          {/* SUMBER */}

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-slate-600">
              Sumber APF
            </label>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-black outline-none focus:border-[#D4A72C] focus:bg-white"
            >
              <option value="ALL">Semua Sumber</option>
              <option value="BPK">BPK</option>
              <option value="ITJEN">Itjen</option>
            </select>
          </div>

          {/* STATUS */}

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-slate-600">
              Status Tindak Lanjut
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-black outline-none focus:border-[#D4A72C] focus:bg-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="BELUM_TL">Belum TL</option>
              <option value="SUDAH_TL">Sudah TL</option>
              <option value="SUDAH_TUNTAS">Sudah Tuntas</option>
            </select>
          </div>

          {/* KATEGORI */}

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-slate-600">
              Kategori
            </label>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-black outline-none focus:border-[#D4A72C] focus:bg-white"
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
      </section>

      {/* =====================================================
          KPI
      ===================================================== */}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {/* TOTAL */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total
              </p>

              <p className="mt-2 text-2xl font-bold text-[#071426]">{total}</p>

              <p className="mt-1 text-[10px] text-slate-400">
                Total rekomendasi
              </p>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF3FA] text-sm">
              📋
            </span>
          </div>
        </div>

        {/* MASUK SALDO */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Masuk Saldo
              </p>

              <p className="mt-2 text-2xl font-bold text-green-600">
                {masukSaldo}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                {persentaseSaldo}% dari total
              </p>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-sm">
              💰
            </span>
          </div>
        </div>

        {/* BELUM SALDO */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Belum Saldo
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {belumSaldo}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                Belum masuk saldo
              </p>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-sm">
              ⚠️
            </span>
          </div>
        </div>

        {/* BELUM TL */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Belum TL
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">{belumTl}</p>

              <p className="mt-1 text-[10px] text-slate-400">
                Belum ditindaklanjuti
              </p>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-sm">
              ⏳
            </span>
          </div>
        </div>

        {/* SUDAH TL */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sudah TL
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-600">
                {sudahTl}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                {persentaseSudahTl}% dari total
              </p>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-sm">
              🔄
            </span>
          </div>
        </div>

        {/* SUDAH TUNTAS */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sudah Tuntas
              </p>

              <p className="mt-2 text-2xl font-bold text-green-600">
                {sudahTuntas}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                {persentaseTuntas}% dari total
              </p>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-sm">
              ✅
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================
          MONITORING
      ===================================================== */}

      <section className="mb-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* STATUS */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-sm font-bold text-[#071426]">
              Status Tindak Lanjut
            </h2>

            <p className="mt-1 text-[11px] text-slate-400">
              Distribusi status rekomendasi berdasarkan filter aktif.
            </p>
          </div>

          <div className="space-y-5">
            {/* TUNTAS */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Sudah Tuntas
                </span>

                <span className="text-xs font-bold text-slate-800">
                  {sudahTuntas}
                  <span className="ml-1 font-normal text-slate-400">
                    ({persentaseTuntas}%)
                  </span>
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
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
                <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Sudah TL
                </span>

                <span className="text-xs font-bold text-slate-800">
                  {sudahTl}
                  <span className="ml-1 font-normal text-slate-400">
                    ({persentaseSudahTl}%)
                  </span>
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
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
                <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Belum TL
                </span>

                <span className="text-xs font-bold text-slate-800">
                  {belumTl}
                  <span className="ml-1 font-normal text-slate-400">
                    ({persentaseBelumTl}%)
                  </span>
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
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

        {/* CAPAIAN */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#071426]">
              Capaian Tindak Lanjut
            </h2>

            <p className="mt-1 text-[11px] text-slate-400">
              Persentase rekomendasi yang sudah tuntas.
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div
              className="relative flex h-40 w-40 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(
                  #16A34A ${persentaseTuntas}%,
                  #F1F5F9 ${persentaseTuntas}% 100%
                )`,
              }}
            >
              <div className="flex h-30 w-30 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-3xl font-bold text-[#071426]">
                  {persentaseTuntas}%
                </span>

                <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Tuntas
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs font-semibold text-slate-700">
              {sudahTuntas} dari {total} rekomendasi
            </p>

            <p className="mt-1 text-[10px] text-slate-400">
              telah menyelesaikan tindak lanjut.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          SUMBER APF
      ===================================================== */}

      <section className="mb-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                BPK
              </p>

              <p className="mt-2 text-3xl font-bold text-[#071426]">
                {bpkTotal}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                Rekomendasi hasil pemeriksaan BPK
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3FA] text-lg">
              🏛️
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                ITJEN
              </p>

              <p className="mt-2 text-3xl font-bold text-[#071426]">
                {itjenTotal}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                Rekomendasi hasil pemeriksaan Itjen
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3FA] text-lg">
              🛡️
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          TABLE
      ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF3FA] text-sm">
                  📊
                </span>

                <div>
                  <h2 className="text-sm font-bold text-[#071426]">
                    Rekapitulasi Data APF
                  </h2>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Data laporan berdasarkan filter yang dipilih.
                  </p>
                </div>
              </div>
            </div>

            <input
              type="text"
              placeholder="Cari LHA, No Temuan, Judul, UIC, Tindak Lanjut..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-black placeholder:text-slate-400 outline-none transition focus:border-[#D4A72C] focus:bg-white sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#D4A72C]" />

            <p className="text-xs text-slate-400">Memuat laporan...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
              —
            </div>

            <p className="text-sm font-semibold text-slate-700">
              Tidak ada data ditemukan
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Coba ubah filter atau pencarian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    No
                  </th>

                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    APF
                  </th>

                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    LHA / LHP
                  </th>

                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tanggal
                  </th>

                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Kategori
                  </th>

                  <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Rek.
                  </th>

                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Saldo
                  </th>

                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tindak Lanjut
                  </th>

                  <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredData.map((item, index) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {index + 1}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-lg bg-[#071B41] px-3 py-1.5 text-[10px] font-bold text-white">
                        {item.source}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-[#071426]">
                        {item.lha_number}
                      </p>

                      {item.description && (
                        <p className="mt-1 max-w-xs truncate text-[10px] text-slate-400">
                          {item.description}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600">
                      {formatDate(item.lha_date)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-medium text-slate-600">
                        {item.category}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="text-xs font-bold text-[#071426]">
                        {item.recommendation_count}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${
                          item.saldo_status === "MASUK_SALDO"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : item.saldo_status === "BELUM_SALDO"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {getSaldoLabel(item.saldo_status)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${getStatusStyle(
                          item.follow_up_status
                        )}`}
                      >
                        {getStatusLabel(item.follow_up_status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelected(item)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 transition hover:border-[#D4A72C] hover:text-[#9B7518]"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <p className="text-[10px] text-slate-400">
            Menampilkan{" "}
            <span className="font-semibold text-slate-600">
              {filteredData.length}
            </span>{" "}
            data dari{" "}
            <span className="font-semibold text-slate-600">{data.length}</span>{" "}
            total data APF
          </p>
        </div>
      </section>

      {/* =====================================================
          DETAIL DRAWER
      ===================================================== */}

      {selected && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="absolute inset-0 bg-[#071426]/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            {/* HEADER DRAWER */}

            <div className="border-b border-slate-200 bg-[#071B41] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200">
                    Detail Laporan APF
                  </span>

                  <h2 className="mt-2 text-xl font-bold">
                    {selected.lha_number}
                  </h2>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {/* SUMMARY */}

              <div className="rounded-2xl bg-[#071B41] p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-blue-200">Sumber APF</p>

                    <p className="mt-1 text-xl font-bold">{selected.source}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-blue-200">
                      Jumlah Rekomendasi
                    </p>

                    <p className="mt-1 text-3xl font-bold">
                      {selected.recommendation_count}
                    </p>
                  </div>
                </div>
              </div>

              {/* DETAIL GRID */}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] text-slate-400">Nomor LHA / LHP</p>

                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    {selected.lha_number}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] text-slate-400">Tanggal</p>

                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    {formatDate(selected.lha_date)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] text-slate-400">Kategori</p>

                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    {selected.category}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] text-slate-400">Status Saldo</p>

                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${
                        selected.saldo_status === "MASUK_SALDO"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : selected.saldo_status === "BELUM_SALDO"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {getSaldoLabel(selected.saldo_status)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                  <p className="text-[10px] text-slate-400">
                    Status Tindak Lanjut
                  </p>

                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${getStatusStyle(
                        selected.follow_up_status
                      )}`}
                    >
                      {getStatusLabel(selected.follow_up_status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* DETAIL REKOMENDASI */}

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Detail Rekomendasi
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Informasi temuan dan tindak lanjut rekomendasi.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* NO TEMUAN */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] text-slate-400">No Temuan</p>

                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      {selected.no_temuan || "-"}
                    </p>
                  </div>

                  {/* JUDUL */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] text-slate-400">Judul</p>

                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-700">
                      {selected.judul || "-"}
                    </p>
                  </div>

                  {/* RENCANA AKSI */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                    <p className="text-[10px] text-slate-400">Rencana Aksi</p>

                    <p className="mt-2 text-xs leading-6 text-slate-600">
                      {selected.rencana_aksi || "-"}
                    </p>
                  </div>

                  {/* KETERANGAN / BUKTI DUKUNG */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                    <p className="text-[10px] text-slate-400">
                      Keterangan / Bukti Dukung
                    </p>

                    <p className="mt-2 text-xs leading-6 text-slate-600">
                      {selected.keterangan_bukti_dukung || "-"}
                    </p>
                  </div>

                  {/* WAKTU PELAKSANAAN */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] text-slate-400">
                      Waktu Pelaksanaan
                    </p>

                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      {selected.waktu_pelaksanaan
                        ? formatDate(selected.waktu_pelaksanaan)
                        : "-"}
                    </p>
                  </div>

                  {/* UIC */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] text-slate-400">UIC</p>

                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      {selected.uic || "-"}
                    </p>
                  </div>

                  {/* TINDAK LANJUT */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                    <p className="text-[10px] text-slate-400">Tindak Lanjut</p>

                    <p className="mt-2 text-xs leading-6 text-slate-600">
                      {selected.tindak_lanjut || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
