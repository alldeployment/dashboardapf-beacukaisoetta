"use client";

import { useEffect, useMemo, useState } from "react";
import RecommendationForm from "@/components/RecommendationForm";
import ImportDocumentModal from "@/components/ImportDocumentModal";

type Recommendation = {
  id: number;
  source: string;
  category: string;
  lha_number: string;
  lha_date: string;
  recommendation_count: number;
  follow_up_status: string;
  saldo_status: string;
  recommendation?: string | null;
  description: string | null;
  created_at?: string;
};

type Summary = {
  total: number;
  belumTl: number;
  sudahTl: number;
  sudahTuntas: number;
  masukSaldo: number;
  belumSaldo: number;
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

const EMPTY_SUMMARY: Summary = {
  total: 0,
  belumTl: 0,
  sudahTl: 0,
  sudahTuntas: 0,
  masukSaldo: 0,
  belumSaldo: 0,
  capaian: 0,

  bpk: {
    total: 0,
    masukSaldo: 0,
    belumSaldo: 0,
    keuangan: 0,
    bukanKeuangan: 0,
    persentaseSaldo: 0,
  },

  itjen: {
    total: 0,
    belumTl: 0,
    sudahTl: 0,
    sudahTuntas: 0,
  },
};

export default function RekomendasiPage() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [source, setSource] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [saldo, setSaldo] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Recommendation | null>(null);

  const [detail, setDetail] = useState<Recommendation | null>(null);

  const [showImport, setShowImport] = useState(false);

  /* ============================================================
     LOAD DATA
  ============================================================ */

  async function loadData(isRefresh = false) {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [dataRes, summaryRes] = await Promise.all([
        fetch("/api/recommendations", {
          cache: "no-store",
        }),

        fetch("/api/dashboard/summary", {
          cache: "no-store",
        }),
      ]);

      if (!dataRes.ok) {
        throw new Error("Gagal mengambil data rekomendasi.");
      }

      const dataJson = await dataRes.json();
      const summaryJson = await summaryRes.json();

      if (!dataJson.ok) {
        throw new Error(
          dataJson.message || "Gagal mengambil data rekomendasi."
        );
      }

      setData(Array.isArray(dataJson.data) ? dataJson.data : []);

      if (summaryJson.ok && summaryJson.data) {
        setSummary({
          ...EMPTY_SUMMARY,
          ...summaryJson.data,

          bpk: {
            ...EMPTY_SUMMARY.bpk,
            ...(summaryJson.data.bpk || {}),
          },

          itjen: {
            ...EMPTY_SUMMARY.itjen,
            ...(summaryJson.data.itjen || {}),
          },
        });
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* ============================================================
     FILTER DATA
  ============================================================ */

  const filteredData = useMemo(() => {
    const q = search.toLowerCase().trim();

    return data.filter((item) => {
      const matchSearch =
        !q ||
        item.lha_number?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.source?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.recommendation?.toLowerCase().includes(q);

      const matchSource = source === "ALL" || item.source === source;

      const matchCategory = category === "ALL" || item.category === category;

      const matchStatus =
        status === "ALL" ||
        item.follow_up_status === status ||
        (status === "SUDAH_TL" && item.follow_up_status === "BELUM_TUNTAS");

      const matchSaldo = saldo === "ALL" || item.saldo_status === saldo;

      return (
        matchSearch && matchSource && matchCategory && matchStatus && matchSaldo
      );
    });
  }, [data, search, source, category, status, saldo]);

  /* ============================================================
     FILTER STATISTICS
  ============================================================ */

  const filteredStats = useMemo(() => {
    const totalRecommendations = filteredData.reduce(
      (sum, item) => sum + Number(item.recommendation_count || 0),
      0
    );

    const totalDocuments = filteredData.length;

    const completed = filteredData
      .filter((item) => item.follow_up_status === "SUDAH_TUNTAS")
      .reduce((sum, item) => sum + Number(item.recommendation_count || 0), 0);

    const sudahTl = filteredData
      .filter(
        (item) =>
          item.follow_up_status === "SUDAH_TL" ||
          item.follow_up_status === "BELUM_TUNTAS"
      )
      .reduce((sum, item) => sum + Number(item.recommendation_count || 0), 0);

    const belumTl = filteredData
      .filter((item) => item.follow_up_status === "BELUM_TL")
      .reduce((sum, item) => sum + Number(item.recommendation_count || 0), 0);

    const masukSaldo = filteredData
      .filter((item) => item.saldo_status === "MASUK_SALDO")
      .reduce((sum, item) => sum + Number(item.recommendation_count || 0), 0);

    const capaian =
      totalRecommendations > 0 ? (completed / totalRecommendations) * 100 : 0;

    return {
      totalDocuments,
      totalRecommendations,
      completed,
      sudahTl,
      belumTl,
      masukSaldo,
      capaian,
    };
  }, [filteredData]);

  /* ============================================================
     DELETE
  ============================================================ */

  async function deleteData(id: number) {
    const confirmed = window.confirm(
      "Apakah kamu yakin ingin menghapus rekomendasi ini?"
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/recommendations?id=${id}`, {
        method: "DELETE",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        alert(json.message || "Gagal menghapus data.");
        return;
      }

      // Tutup detail drawer
      setDetail(null);

      // Hapus langsung dari tampilan
      setData((prev) => prev.filter((item) => item.id !== id));

      // Ambil ulang data + summary
      await loadData(true);

      alert("Rekomendasi berhasil dihapus.");
    } catch (err) {
      console.error("DELETE ERROR:", err);

      alert(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghapus data."
      );
    }
  }

  /* ============================================================
     FORM
  ============================================================ */

  function editData(item: Recommendation) {
    setDetail(null);
    setEditing(item);
    setShowForm(true);
  }

  function openAddForm() {
    setEditing(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  /* ============================================================
     FILTER RESET
  ============================================================ */

  function resetFilters() {
    setSearch("");
    setSource("ALL");
    setCategory("ALL");
    setStatus("ALL");
    setSaldo("ALL");
  }

  /* ============================================================
     FORMAT DATE
  ============================================================ */

  function formatDate(date: string) {
    if (!date) return "-";

    try {
      return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function statusText(value: string) {
    switch (value) {
      case "BELUM_TL":
        return "Belum TL";

      case "SUDAH_TL":
        return "Sudah TL";

      // Kompatibilitas data lama
      case "BELUM_TUNTAS":
        return "Sudah TL";

      case "SUDAH_TUNTAS":
        return "Sudah Tuntas";

      default:
        return value || "-";
    }
  }

  function saldoText(value: string) {
    switch (value) {
      case "MASUK_SALDO":
        return "Masuk Saldo";

      case "BELUM_SALDO":
        return "Belum Saldo";

      case "TIDAK_RELEVAN":
        return "Tidak Relevan";

      default:
        return value || "-";
    }
  }

  function statusClass(value: string) {
    switch (value) {
      case "BELUM_TL":
        return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-100";

      case "SUDAH_TL":
      case "BELUM_TUNTAS":
        return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100";

      case "SUDAH_TUNTAS":
        return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100";

      default:
        return "bg-slate-100 text-slate-600";
    }
  }

  function saldoClass(value: string) {
    switch (value) {
      case "MASUK_SALDO":
        return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100";

      case "BELUM_SALDO":
        return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-100";

      case "TIDAK_RELEVAN":
        return "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200";

      default:
        return "bg-slate-100 text-slate-500";
    }
  }

  /* ============================================================
     OTHER
  ============================================================ */

  const hasFilter =
    search.trim() !== "" ||
    source !== "ALL" ||
    category !== "ALL" ||
    status !== "ALL" ||
    saldo !== "ALL";

  const itjenProgress =
    summary.itjen.total > 0
      ? (summary.itjen.sudahTuntas / summary.itjen.total) * 100
      : 0;

  return (
    <>
      <div className="min-h-[calc(100vh-80px)] bg-[#F4F7FB]">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* ==================================================
              HEADER
          ================================================== */}

          <section className="mb-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-medium">
                  <span className="text-slate-400">Data Management</span>

                  <span className="text-slate-300">/</span>

                  <span className="text-[#A77D16]">Rekomendasi</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-1 rounded-full bg-[#D4A72C]" />

                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#071426] sm:text-3xl">
                      Monitoring Rekomendasi APF
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                      Monitoring dan pengelolaan tindak lanjut hasil pemeriksaan
                      BPK dan Itjen.
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTION HEADER */}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D4A72C] bg-white px-5 text-sm font-semibold text-[#A77D16] shadow-sm transition hover:bg-amber-50 active:scale-[0.98]"
                >
                  <span className="text-lg leading-none">↑</span>
                  Import Dokumen
                </button>

                <button
                  type="button"
                  onClick={openAddForm}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10294a] active:scale-[0.98]"
                >
                  <span className="text-xl leading-none">+</span>
                  Tambah Rekomendasi
                </button>
              </div>
            </div>
          </section>

          {/* ==================================================
              KPI
          ================================================== */}

          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total Rekomendasi"
              value={summary.total}
              description="Seluruh rekomendasi"
              icon="#"
            />

            <KpiCard
              label="Sudah Tuntas"
              value={summary.sudahTuntas}
              description="Rekomendasi selesai"
              icon="✓"
              variant="green"
            />

            <KpiCard
              label="Sudah TL"
              value={summary.sudahTl}
              description="Sudah tindak lanjut"
              icon="→"
              variant="amber"
            />

            <KpiCard
              label="Capaian"
              value={`${Number(summary.capaian || 0).toFixed(1)}%`}
              description="Persentase penyelesaian"
              icon="%"
              variant="gold"
              progress={summary.capaian}
            />
          </section>

          {/* ==================================================
              SOURCE MONITORING
          ================================================== */}

          <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* BPK */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#071426] text-xs font-bold text-[#D4A72C]">
                    BPK
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#071426]">
                      Pemeriksaan BPK
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Rekapitulasi rekomendasi BPK
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-[#071426]">
                    {summary.bpk.total}
                  </p>

                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Rekomendasi
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Capaian Saldo
                  </span>

                  <span className="text-xs font-bold text-[#071426]">
                    {Number(summary.bpk.persentaseSaldo || 0).toFixed(0)}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#D4A72C] transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        Number(summary.bpk.persentaseSaldo || 0),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50">
                <MiniStat
                  label="Masuk Saldo"
                  value={summary.bpk.masukSaldo}
                  color="green"
                />

                <MiniStat
                  label="Belum Saldo"
                  value={summary.bpk.belumSaldo}
                  color="red"
                />

                <MiniStat
                  label="Keuangan"
                  value={summary.bpk.keuangan}
                  color="dark"
                />
              </div>
            </div>

            {/* ITJEN */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#071426] text-xs font-bold text-[#D4A72C]">
                    ITJ
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#071426]">
                      Pemeriksaan Itjen
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Rekapitulasi tindak lanjut Itjen
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-[#071426]">
                    {summary.itjen.total}
                  </p>

                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Rekomendasi
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Penyelesaian
                  </span>

                  <span className="text-xs font-bold text-[#071426]">
                    {itjenProgress.toFixed(0)}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(itjenProgress, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50">
                <MiniStat
                  label="Sudah Tuntas"
                  value={summary.itjen.sudahTuntas}
                  color="green"
                />

                <MiniStat
                  label="Sudah TL"
                  value={summary.itjen.sudahTl}
                  color="amber"
                />

                <MiniStat
                  label="Belum TL"
                  value={summary.itjen.belumTl}
                  color="red"
                />
              </div>
            </div>
          </section>

          {/* ==================================================
              DATA TABLE
          ================================================== */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* TOOLBAR */}

            <div className="border-b border-slate-200 px-4 py-5 sm:px-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-[#071426]">
                      Daftar Rekomendasi
                    </h2>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      {filteredData.length} dokumen
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    Kelola seluruh data rekomendasi yang tersimpan.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={source === "ALL"}
                    onClick={() => setSource("ALL")}
                  >
                    Semua
                  </FilterButton>

                  <FilterButton
                    active={source === "BPK"}
                    onClick={() => setSource("BPK")}
                  >
                    BPK
                  </FilterButton>

                  <FilterButton
                    active={source === "ITJEN"}
                    onClick={() => setSource("ITJEN")}
                  >
                    Itjen
                  </FilterButton>
                </div>
              </div>

              {/* SEARCH */}

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_180px_auto]">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ⌕
                  </span>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nomor LHA, kategori, sumber, rekomendasi..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#D4A72C] focus:bg-white"
                  />
                </div>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-[#D4A72C] focus:bg-white"
                >
                  <option value="ALL">Semua Kategori</option>

                  <option value="Laporan Keuangan">Laporan Keuangan</option>

                  <option value="Bukan Keuangan">Bukan Keuangan</option>

                  <option value="Tindak Lanjut Pemeriksaan">
                    Tindak Lanjut Pemeriksaan
                  </option>
                </select>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-[#D4A72C] focus:bg-white"
                >
                  <option value="ALL">Semua Status</option>

                  <option value="BELUM_TL">Belum TL</option>

                  <option value="SUDAH_TL">Sudah TL</option>

                  <option value="SUDAH_TUNTAS">Sudah Tuntas</option>
                </select>

                <select
                  value={saldo}
                  onChange={(e) => setSaldo(e.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-[#D4A72C] focus:bg-white"
                >
                  <option value="ALL">Semua Saldo</option>

                  <option value="MASUK_SALDO">Masuk Saldo</option>

                  <option value="BELUM_SALDO">Belum Saldo</option>

                  <option value="TIDAK_RELEVAN">Tidak Relevan</option>
                </select>

                <button
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-500 transition hover:border-[#D4A72C] hover:text-[#A77D16] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refreshing ? "Memuat..." : "↻ Refresh"}
                </button>
              </div>

              {/* ACTIVE FILTER */}

              {hasFilter && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Filter aktif:
                  </span>

                  {source !== "ALL" && (
                    <ActiveFilter label={`Sumber: ${source}`} />
                  )}

                  {category !== "ALL" && (
                    <ActiveFilter label={`Kategori: ${category}`} />
                  )}

                  {status !== "ALL" && (
                    <ActiveFilter label={`Status: ${statusText(status)}`} />
                  )}

                  {saldo !== "ALL" && (
                    <ActiveFilter label={`Saldo: ${saldoText(saldo)}`} />
                  )}

                  {search && <ActiveFilter label={`Pencarian: "${search}"`} />}

                  <button
                    onClick={resetFilters}
                    className="ml-1 text-[10px] font-semibold text-[#A77D16] hover:underline"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* FILTER SUMMARY */}

            <div className="grid grid-cols-2 border-b border-slate-100 bg-[#FAFBFC] sm:grid-cols-4">
              <FilterSummary
                label="Dokumen"
                value={filteredStats.totalDocuments}
              />

              <FilterSummary
                label="Rekomendasi"
                value={filteredStats.totalRecommendations}
              />

              <FilterSummary
                label="Sudah Tuntas"
                value={filteredStats.completed}
                valueClass="text-emerald-600"
              />

              <FilterSummary
                label="Masuk Saldo"
                value={filteredStats.masukSaldo}
                valueClass="text-[#A77D16]"
              />
            </div>

            {/* ERROR */}

            {error && (
              <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <div className="flex items-center justify-between gap-3">
                  <span>{error}</span>

                  <button
                    onClick={() => loadData()}
                    className="font-semibold underline"
                  >
                    Coba lagi
                  </button>
                </div>
              </div>
            )}

            {/* TABLE */}

            <div className="overflow-x-auto">
              {loading ? (
                <LoadingState />
              ) : filteredData.length === 0 ? (
                <EmptyState
                  hasFilter={hasFilter}
                  onReset={resetFilters}
                  onAdd={openAddForm}
                />
              ) : (
                <table className="w-full min-w-[1150px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#FAFBFC]">
                      <th className="w-16 px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        No
                      </th>

                      <th className="w-24 px-4 py-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Sumber
                      </th>

                      <th className="px-4 py-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        LHA / LHP
                      </th>

                      <th className="w-32 px-4 py-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Tanggal
                      </th>

                      <th className="w-20 px-4 py-4 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Rek.
                      </th>

                      <th className="w-36 px-4 py-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Tindak Lanjut
                      </th>

                      <th className="w-32 px-4 py-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Saldo
                      </th>

                      <th className="w-40 px-5 py-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Aksi
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredData.map((item, index) => (
                      <tr
                        key={item.id}
                        onClick={() => setDetail(item)}
                        className="group cursor-pointer border-b border-slate-100 transition hover:bg-[#FAFBFC]"
                      >
                        <td className="px-5 py-4 text-xs font-medium text-slate-400">
                          {String(index + 1).padStart(2, "0")}
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex items-center rounded-md bg-[#071426] px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-[#D4A72C]">
                            {item.source}
                          </span>
                        </td>

                        <td className="max-w-[360px] px-4 py-4">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {item.lha_number}
                          </p>

                          <p className="mt-1 truncate text-[11px] text-slate-400">
                            {item.category}
                          </p>

                          {item.recommendation && (
                            <p className="mt-1 truncate text-[10px] text-slate-400">
                              {item.recommendation}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4 text-xs font-medium text-slate-500">
                          {formatDate(item.lha_date)}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-bold text-[#071426]">
                            {item.recommendation_count}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1.5 text-[9px] font-bold ${statusClass(
                              item.follow_up_status
                            )}`}
                          >
                            {statusText(item.follow_up_status)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1.5 text-[9px] font-semibold ${saldoClass(
                              item.saldo_status
                            )}`}
                          >
                            {saldoText(item.saldo_status)}
                          </span>
                        </td>

                        <td
                          className="px-5 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1.5 opacity-70 transition group-hover:opacity-100">
                            <button
                              onClick={() => editData(item)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[#D4A72C] hover:text-[#A77D16]"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deleteData(item.id)}
                              className="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* FOOTER */}

            {!loading && filteredData.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-[#FAFBFC] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-slate-400">
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-600">
                    {filteredData.length}
                  </span>{" "}
                  dokumen dengan{" "}
                  <span className="font-semibold text-slate-600">
                    {filteredStats.totalRecommendations}
                  </span>{" "}
                  rekomendasi.
                </p>

                <button
                  onClick={() => loadData(true)}
                  className="text-[11px] font-semibold text-[#A77D16] hover:underline"
                >
                  ↻ Perbarui data
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ========================================================
          ADD / EDIT MODAL
      ======================================================== */}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071426]/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#A77D16]">
                  APF DATA MANAGEMENT
                </p>

                <h2 className="mt-1 text-lg font-bold text-[#071426]">
                  {editing ? "Edit Rekomendasi" : "Tambah Rekomendasi"}
                </h2>
              </div>

              <button
                onClick={closeForm}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <RecommendationForm
                onSaved={() => {
                  closeForm();
                  loadData(true);
                }}
                editingData={editing}
                onCancelEdit={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          IMPORT DOCUMENT MODAL
      ======================================================== */}

      {showImport && (
        <ImportDocumentModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            loadData(true);
          }}
        />
      )}

      {/* ========================================================
          DETAIL DRAWER
      ======================================================== */}

      {detail && (
        <div className="fixed inset-0 z-[90] bg-[#071426]/30">
          <button
            onClick={() => setDetail(null)}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Tutup detail"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  DETAIL REKOMENDASI
                </p>

                <h2 className="mt-1 max-w-[280px] truncate text-lg font-bold text-[#071426]">
                  {detail.lha_number}
                </h2>
              </div>

              <button
                onClick={() => setDetail(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              {/* SOURCE */}

              <div className="rounded-2xl bg-[#071426] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      Sumber Pemeriksaan
                    </p>

                    <p className="mt-2 text-2xl font-bold text-white">
                      {detail.source}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4A72C]/10 text-sm font-bold text-[#D4A72C]">
                    APF
                  </div>
                </div>
              </div>

              {/* DATE + COUNT */}

              <div className="grid grid-cols-2 gap-3">
                <DetailBox
                  label="Tanggal"
                  value={formatDate(detail.lha_date)}
                />

                <DetailBox
                  label="Jumlah Rekomendasi"
                  value={String(detail.recommendation_count)}
                />
              </div>

              <DetailBox label="Nomor LHA / LHP" value={detail.lha_number} />

              <DetailBox label="Kategori" value={detail.category} />

              {/* STATUS */}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Tindak Lanjut
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-md px-2.5 py-1.5 text-[10px] font-bold ${statusClass(
                      detail.follow_up_status
                    )}`}
                  >
                    {statusText(detail.follow_up_status)}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Status Saldo
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-md px-2.5 py-1.5 text-[10px] font-bold ${saldoClass(
                      detail.saldo_status
                    )}`}
                  >
                    {saldoText(detail.saldo_status)}
                  </span>
                </div>
              </div>

              {/* REKOMENDASI */}

              <div className="rounded-xl border border-[#D4A72C]/30 bg-[#D4A72C]/5 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D4A72C]/15 text-xs font-bold text-[#A77D16]">
                    !
                  </div>

                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#A77D16]">
                    Rekomendasi / Yang Harus Dilakukan
                  </p>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {detail.recommendation ||
                    "Belum ada data rekomendasi yang tercatat."}
                </p>
              </div>

              {/* DESCRIPTION */}

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  Keterangan
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {detail.description || "Tidak ada keterangan."}
                </p>
              </div>

              {/* ACTION */}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => editData(detail)}
                  className="flex-1 rounded-xl bg-[#071426] py-3 text-sm font-semibold text-white transition hover:bg-[#10294a]"
                >
                  Edit Data
                </button>

                <button
                  onClick={() => deleteData(detail.id)}
                  className="rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Hapus
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function KpiCard({
  label,
  value,
  description,
  icon,
  variant = "default",
  progress,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: string;
  variant?: "default" | "green" | "amber" | "gold";
  progress?: number;
}) {
  const variants = {
    default: {
      border: "border-slate-200",
      bg: "bg-slate-50",
      icon: "text-[#071426]",
      value: "text-[#071426]",
    },

    green: {
      border: "border-emerald-100",
      bg: "bg-emerald-50",
      icon: "text-emerald-600",
      value: "text-emerald-700",
    },

    amber: {
      border: "border-amber-100",
      bg: "bg-amber-50",
      icon: "text-amber-600",
      value: "text-amber-600",
    },

    gold: {
      border: "border-[#D4A72C]/25",
      bg: "bg-[#D4A72C]/10",
      icon: "text-[#A77D16]",
      value: "text-[#071426]",
    },
  };

  const v = variants[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${v.border} bg-white p-5 shadow-sm`}
    >
      <div
        className={`absolute right-0 top-0 h-20 w-20 rounded-bl-full ${v.bg}`}
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </span>

          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${v.bg} text-xs font-bold ${v.icon}`}
          >
            {icon}
          </span>
        </div>

        <p className={`mt-4 text-3xl font-bold tracking-tight ${v.value}`}>
          {value}
        </p>

        <p className="mt-1 text-xs text-slate-400">{description}</p>

        {typeof progress === "number" && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#D4A72C] transition-all duration-500"
              style={{
                width: `${Math.min(Math.max(progress, 0), 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "red" | "amber" | "dark";
}) {
  const classes = {
    green: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
    dark: "text-[#071426]",
  };

  return (
    <div className="p-3 text-center">
      <p className="text-[10px] text-slate-400">{label}</p>

      <p className={`mt-1 text-lg font-bold ${classes[color]}`}>{value}</p>
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-[#071426] text-white"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function ActiveFilter({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[#071426] px-2.5 py-1 text-[10px] font-medium text-white">
      {label}
    </span>
  );
}

function FilterSummary({
  label,
  value,
  valueClass = "text-[#071426]",
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="border-r border-slate-100 px-4 py-3 last:border-r-0">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className={`mt-1 text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">
        {value || "-"}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-80 flex-col items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#D4A72C]" />

      <p className="mt-4 text-sm font-medium text-slate-500">
        Memuat data rekomendasi...
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Mengambil data terbaru dari sistem APF
      </p>
    </div>
  );
}

function EmptyState({
  hasFilter,
  onReset,
  onAdd,
}: {
  hasFilter: boolean;
  onReset: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex h-80 flex-col items-center justify-center px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
        —
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-600">
        {hasFilter ? "Data tidak ditemukan" : "Belum ada rekomendasi"}
      </p>

      <p className="mt-1 max-w-sm text-xs text-slate-400">
        {hasFilter
          ? "Tidak ada rekomendasi yang sesuai dengan filter yang dipilih."
          : "Belum terdapat data rekomendasi yang tersimpan pada sistem."}
      </p>

      <div className="mt-4 flex gap-2">
        {hasFilter && (
          <button
            onClick={onReset}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Reset Filter
          </button>
        )}

        <button
          onClick={onAdd}
          className="rounded-lg bg-[#071426] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#10294a]"
        >
          + Tambah Rekomendasi
        </button>
      </div>
    </div>
  );
}
