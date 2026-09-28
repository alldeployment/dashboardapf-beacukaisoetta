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

export default function LaporanPage() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // FILTER
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Recommendation | null>(null);

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

  // =========================
  // DATA FILTER
  // =========================

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const itemDate = item.lha_date ? item.lha_date.substring(0, 10) : "";

      const matchesDate =
        (!startDate || itemDate >= startDate) &&
        (!endDate || itemDate <= endDate);

      const matchesSource =
        sourceFilter === "ALL" || item.source === sourceFilter;

      // Kompatibilitas data lama:
      // BELUM_TUNTAS dianggap SUDAH_TL
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
        (item.description || "").toLowerCase().includes(keyword);

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

  // =========================
  // REKAP
  // =========================

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

  // =========================
  // HELPER
  // =========================

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

  // =========================
  // EXPORT EXCEL
  // =========================

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

  const resetFilter = () => {
    setStartDate("");
    setEndDate("");
    setSourceFilter("ALL");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setSearch("");
  };

  return (
    <main className="min-h-screen bg-[#F4F7FB] px-6 py-8 lg:px-8">
      {/* ================= HEADER ================= */}
      <section className="mb-8">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />

              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Data Management
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#071426]">
              Laporan APF
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Rekapitulasi data rekomendasi hasil pemeriksaan BPK dan Itjen pada
              KPUBC Tipe C Soekarno-Hatta.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={exportExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#071426] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102746]"
            >
              <span>↓</span>
              Export Excel
            </button>

            <button
              onClick={loadData}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#D4A72C] hover:text-[#9B7518]"
            >
              <span>↻</span>
              Refresh Data
            </button>
          </div>
        </div>
      </section>

      {/* ================= ERROR ================= */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ================= FILTER ================= */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-bold text-[#071426]">Filter Laporan</h2>

            <p className="mt-1 text-xs text-slate-400">
              Gunakan filter untuk menampilkan data tertentu dan membuat laporan
              yang lebih spesifik.
            </p>
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
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Tanggal Mulai
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ colorScheme: "light" }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-black outline-none transition focus:border-[#D4A72C] focus:bg-white focus:text-black"
            />
          </div>

          {/* TANGGAL AKHIR */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Tanggal Akhir
            </label>

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ colorScheme: "light" }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-black outline-none transition focus:border-[#D4A72C] focus:bg-white focus:text-black"
            />
          </div>

          {/* SUMBER */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Sumber APF
            </label>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-black outline-none focus:border-[#D4A72C] focus:bg-white"
            >
              <option value="ALL">Semua Sumber</option>
              <option value="BPK">BPK</option>
              <option value="ITJEN">Itjen</option>
            </select>
          </div>

          {/* STATUS */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Status Tindak Lanjut
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-black outline-none focus:border-[#D4A72C] focus:bg-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="BELUM_TL">Belum TL</option>
              <option value="SUDAH_TL">Sudah TL</option>
              <option value="SUDAH_TUNTAS">Sudah Tuntas</option>
            </select>
          </div>

          {/* KATEGORI */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Kategori
            </label>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-black outline-none focus:border-[#D4A72C] focus:bg-white"
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

      {/* ================= KPI ================= */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total
          </p>

          <p className="mt-3 text-3xl font-bold text-[#071426]">{total}</p>

          <p className="mt-1 text-xs text-slate-400">Total rekomendasi</p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Masuk Saldo
          </p>

          <p className="mt-3 text-3xl font-bold text-green-600">{masukSaldo}</p>

          <p className="mt-1 text-xs text-slate-400">
            {persentaseSaldo}% dari total
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Belum Saldo
          </p>

          <p className="mt-3 text-3xl font-bold text-red-600">{belumSaldo}</p>

          <p className="mt-1 text-xs text-slate-400">Belum masuk saldo</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Belum TL
          </p>

          <p className="mt-3 text-3xl font-bold text-red-600">{belumTl}</p>

          <p className="mt-1 text-xs text-slate-400">Belum ditindaklanjuti</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Sudah TL
          </p>

          <p className="mt-3 text-3xl font-bold text-amber-600">{sudahTl}</p>

          <p className="mt-1 text-xs text-slate-400">
            {persentaseSudahTl}% dari total
          </p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Sudah Tuntas
          </p>

          <p className="mt-3 text-3xl font-bold text-green-600">
            {sudahTuntas}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {persentaseTuntas}% dari total
          </p>
        </div>
      </section>

      {/* ================= MONITORING ================= */}
      <section className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* STATUS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="font-bold text-[#071426]">Status Tindak Lanjut</h2>

            <p className="mt-1 text-xs text-slate-400">
              Distribusi status rekomendasi berdasarkan filter aktif
            </p>
          </div>

          <div className="space-y-6">
            {/* SUDAH TUNTAS */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  Sudah Tuntas
                </span>

                <span className="text-sm font-bold text-slate-800">
                  {sudahTuntas}{" "}
                  <span className="font-normal text-slate-400">
                    ({persentaseTuntas}%)
                  </span>
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

                <span className="text-sm font-bold text-slate-800">
                  {sudahTl}{" "}
                  <span className="font-normal text-slate-400">
                    ({persentaseSudahTl}%)
                  </span>
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

                <span className="text-sm font-bold text-slate-800">
                  {belumTl}{" "}
                  <span className="font-normal text-slate-400">
                    ({persentaseBelumTl}%)
                  </span>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="font-bold text-[#071426]">Capaian Tindak Lanjut</h2>

            <p className="mt-1 text-xs text-slate-400">
              Persentase rekomendasi yang sudah tuntas
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div
              className="relative flex h-48 w-48 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(
                  #16A34A ${persentaseTuntas}%,
                  #F1F5F9 ${persentaseTuntas}% 100%
                )`,
              }}
            >
              <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-4xl font-bold text-[#071426]">
                  {persentaseTuntas}%
                </span>

                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Tuntas
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {sudahTuntas} dari {total} rekomendasi
            </p>

            <p className="mt-1 text-xs text-slate-400">
              telah menyelesaikan tindak lanjut
            </p>
          </div>
        </div>
      </section>

      {/* ================= SUMBER ================= */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            BPK
          </p>

          <p className="mt-2 text-3xl font-bold text-[#071426]">{bpkTotal}</p>

          <p className="mt-1 text-xs text-slate-400">
            Rekomendasi hasil pemeriksaan BPK
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Itjen
          </p>

          <p className="mt-2 text-3xl font-bold text-[#071426]">{itjenTotal}</p>

          <p className="mt-1 text-xs text-slate-400">
            Rekomendasi hasil pemeriksaan Itjen
          </p>
        </div>
      </section>

      {/* ================= TABLE ================= */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <h2 className="font-bold text-[#071426]">
                Rekapitulasi Data APF
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Data laporan berdasarkan filter yang dipilih.
              </p>
            </div>

            {/* SEARCH */}
            <input
              type="text"
              placeholder="Cari nomor LHA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-black placeholder:text-slate-400 outline-none transition focus:border-[#D4A72C] focus:bg-white focus:text-black sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#D4A72C]" />

            <p className="text-sm text-slate-400">Memuat laporan...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
              —
            </div>

            <p className="font-semibold text-slate-700">
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
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    No
                  </th>

                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    APF
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
                    Rek.
                  </th>

                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Saldo
                  </th>

                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tindak Lanjut
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
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {index + 1}
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-lg bg-[#071426] px-3 py-1.5 text-xs font-bold text-white">
                        {item.source}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#071426]">
                        {item.lha_number}
                      </p>

                      {item.description && (
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                          {item.description}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(item.lha_date)}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                        {item.category}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-[#071426]">
                        {item.recommendation_count}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${
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

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${getStatusStyle(
                          item.follow_up_status
                        )}`}
                      >
                        {getStatusLabel(item.follow_up_status)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelected(item)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#D4A72C] hover:text-[#9B7518]"
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

        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <p className="text-xs text-slate-400">
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

      {/* ================= DETAIL DRAWER ================= */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="absolute inset-0 bg-[#071426]/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4A72C]">
                    Detail Laporan APF
                  </span>

                  <h2 className="mt-2 text-xl font-bold text-[#071426]">
                    {selected.lha_number}
                  </h2>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="rounded-2xl bg-[#071426] p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Sumber APF</p>

                    <p className="mt-1 text-xl font-bold">{selected.source}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">Jumlah Rekomendasi</p>

                    <p className="mt-1 text-3xl font-bold">
                      {selected.recommendation_count}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-400">Nomor LHA / LHP</p>

                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selected.lha_number}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-400">Tanggal</p>

                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {formatDate(selected.lha_date)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-400">Kategori</p>

                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selected.category}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-400">Status Saldo</p>

                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {getSaldoLabel(selected.saldo_status)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <p className="text-xs text-slate-400">Status Tindak Lanjut</p>

                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${getStatusStyle(
                        selected.follow_up_status
                      )}`}
                    >
                      {getStatusLabel(selected.follow_up_status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Keterangan
                </p>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {selected.description || "Tidak ada keterangan."}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
