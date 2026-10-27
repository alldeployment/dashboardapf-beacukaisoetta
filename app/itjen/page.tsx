"use client";

import { useEffect, useMemo, useState } from "react";
import RecommendationForm from "@/components/RecommendationForm";

type Recommendation = {
  id: number;
  source: string;
  category: string;
  lha_number: string;
  lha_date: string;
  recommendation_number?: number | string | null;
  recommendation_count: number;
  follow_up_status: string;
  saldo_status: string;
  description: string | null;
  temuan?: string | null;
  recommendation?: string | null;
  no_temuan?: string | null;
  judul?: string | null;
  rencana_aksi?: string | null;
  keterangan_bukti_dukung?: string | null;
  waktu_pelaksanaan?: string | null;
  uic?: string | null;
  tindak_lanjut?: string | null;
  created_at?: string;
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
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Recommendation | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams(window.location.search);

      const yearFromUrl = params.get("year");
      const yearFromStorage = localStorage.getItem("apfMonitoringYear");

      const isValidYear = (value: string | null) =>
        !!value &&
        /^\d{4}$/.test(value) &&
        Number(value) >= 2026 &&
        Number(value) <= 9998;

      const year = isValidYear(yearFromUrl)
        ? yearFromUrl!
        : isValidYear(yearFromStorage)
        ? yearFromStorage!
        : String(new Date().getFullYear());

      const yearQuery = `?year=${year}`;
      const [recommendationRes, summaryRes] = await Promise.all([
        fetch(`/api/recommendations${yearQuery}`, {
          cache: "no-store",
        }),
        fetch(`/api/dashboard/summary${yearQuery}`, {
          cache: "no-store",
        }),
      ]);

      if (!recommendationRes.ok || !summaryRes.ok) {
        throw new Error("Gagal mengambil data dari server.");
      }

      const recommendationJson = await recommendationRes.json();
      const summaryJson = await summaryRes.json();
      console.log("Data rekomendasi ITJEN:", recommendationJson.data);
      console.log("Data summary dashboard:", summaryJson.data);

      const itjenData: Recommendation[] = (
        recommendationJson.data || []
      ).filter(
        (item: Recommendation) =>
          String(item.source ?? "")
            .trim()
            .toUpperCase() === "ITJEN"
      );

      setData(itjenData);

      // Hitung berdasarkan jumlah baris rekomendasi,
      // bukan menjumlahkan recommendation_count.
      setData(itjenData);

      // Gunakan ringkasan API agar rekomendasi yang berulang
      // tidak dihitung kembali pada kartu statistik.
      const itjenSummary = summaryJson?.data?.itjen;

      if (itjenSummary) {
        setSummary({
          total: Number(itjenSummary.total ?? 0),
          selesai: Number(itjenSummary.sudahTuntas ?? 0),
          proses: Number(itjenSummary.sudahTl ?? 0),
          belum: Number(itjenSummary.belumTl ?? 0),
        });
      } else {
        console.error("Ringkasan ITJEN tidak tersedia:", summaryJson);

        setSummary({
          total: 0,
          selesai: 0,
          proses: 0,
          belum: 0,
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
    void loadData();
  }, []);

  function editData(item: Recommendation) {
    setSelected(null);
    setEditing(item);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function deleteData(item: Recommendation) {
    const confirmed = window.confirm(
      `Hapus rekomendasi ${item.lha_number}? Data yang dihapus tidak dapat dikembalikan.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/recommendations?id=${item.id}`, {
        method: "DELETE",
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || "Gagal menghapus data.");
      }

      setSelected(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Gagal menghapus data.");
    }
  }

  const categories = useMemo(
    () =>
      Array.from(new Set(data.map((item) => item.category).filter(Boolean))),
    [data]
  );

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const matchesSearch =
        !keyword ||
        String(item.lha_number || "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.category || "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.description || "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.no_temuan || "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.judul || "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.recommendation_number || "")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || item.follow_up_status === statusFilter;

      const matchesCategory =
        categoryFilter === "ALL" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [data, search, statusFilter, categoryFilter]);
  const selesaiPercentage =
    summary.total > 0 ? Math.round((summary.selesai / summary.total) * 100) : 0;

  const prosesPercentage =
    summary.total > 0 ? Math.round((summary.proses / summary.total) * 100) : 0;

  const belumPercentage =
    summary.total > 0 ? Math.round((summary.belum / summary.total) * 100) : 0;
  const formatDate = (date?: string | null) => {
    if (!date) return "-";

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

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

  const getLastUpdated = () =>
    lastUpdated
      ? lastUpdated.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "Belum diperbarui";

  return (
    <main className="min-h-screen bg-[#F4F7FB] text-slate-800">
      {/* HEADER */}
      <section className="relative overflow-hidden bg-[#071426]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/images/gedung-bea-cukai.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071426] via-[#071426]/95 to-[#071426]/70" />

        <div className="relative mx-auto max-w-[1600px] px-6 py-9 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
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
                onClick={() => void loadData()}
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

      <div className="mx-auto max-w-[1600px] space-y-7 px-6 py-8 lg:px-10">
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-red-700">
                Terjadi masalah
              </p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
            <button
              onClick={() => void loadData()}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* KPI */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
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
            <div className="mt-7 text-xs text-slate-400">
              Seluruh rekomendasi
            </div>
          </div>

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
                ✓
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
                style={{ width: `${selesaiPercentage}%` }}
              />
            </div>
          </div>

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
                ◷
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
                style={{ width: `${prosesPercentage}%` }}
              />
            </div>
          </div>

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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A72C]/10 text-xl text-[#9A7414]">
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

        {/* ANALYTICS */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

            <div className="mt-8 space-y-6">
              {[
                {
                  label: "Sudah Tuntas",
                  value: summary.selesai,
                  percent: selesaiPercentage,
                  color: "bg-green-500",
                  dot: "bg-green-500",
                },
                {
                  label: "Belum Tuntas",
                  value: summary.proses,
                  percent: prosesPercentage,
                  color: "bg-amber-500",
                  dot: "bg-amber-500",
                },
                {
                  label: "Belum TL",
                  value: summary.belum,
                  percent: belumPercentage,
                  color: "bg-red-500",
                  dot: "bg-red-500",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${item.dot}`} />
                      <span className="text-sm font-semibold text-slate-700">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">
                      {item.value}
                      <span className="ml-1 font-normal text-slate-400">
                        ({item.percent}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-700`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

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

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />
              <h2 className="text-lg font-bold text-[#071426]">
                Klasifikasi Pemeriksaan
              </h2>
            </div>
            <p className="mt-1 text-sm text-[#6B84A8]">
              Distribusi kategori pemeriksaan Itjen
            </p>

            <div className="mt-8 space-y-6">
              {categories.length > 0 ? (
                categories.map((category) => {
                  const normalizeText = (value: string | null | undefined) =>
                    (value ?? "").trim().toUpperCase();

                  const categoryTotal = new Set(
                    data
                      .filter(
                        (item) =>
                          normalizeText(item.category) ===
                          normalizeText(category)
                      )
                      .map((item) => {
                        const lha = normalizeText(item.lha_number);
                        const nomor = item.recommendation_number;

                        const nomorRekomendasi =
                          nomor == null || String(nomor).trim() === ""
                            ? `ID-REC-${item.id}`
                            : String(nomor).trim();

                        return [
                          normalizeText(item.source),
                          normalizeText(item.category),
                          lha || `ID-LHA-${item.id}`,
                          nomorRekomendasi,
                        ].join("::");
                      })
                  ).size;

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
                          style={{ width: `${categoryPercentage}%` }}
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

        {/* TABLE */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

              <div className="flex flex-col gap-3 md:flex-row">
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
                  onClick={() => void loadData()}
                  className="mt-5 rounded-xl bg-[#071426] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#10243e]"
                >
                  Coba Lagi
                </button>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <p className="font-semibold text-slate-700">
                  Tidak ada data ditemukan
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Coba ubah kata pencarian atau filter.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[1200px]">
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
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      No. Temuan
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
                      <td className="px-6 py-5 text-sm font-medium text-slate-400">
                        {index + 1}
                      </td>

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

                      <td className="px-6 py-5 text-sm text-slate-600">
                        {formatDate(item.lha_date)}
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex max-w-[200px] rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                          {item.category || "-"}
                        </span>
                      </td>

                      {/* NO TEMUAN */}
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#071426] px-3 text-sm font-bold text-white">
                          {item.no_temuan || "-"}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusStyle(
                            item.follow_up_status
                          )}`}
                        >
                          {getStatusLabel(item.follow_up_status)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                          {item.saldo_status || "-"}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setSelected(item)}
                            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#D4A72C] hover:bg-[#D4A72C]/5 hover:text-[#9A7414]"
                          >
                            Detail
                          </button>
                          <button
                            onClick={() => editData(item)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void deleteData(item)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
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

      {/* DETAIL DRAWER */}
      {selected && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-[#071426]/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-[#F8FAFC] shadow-2xl">
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9B7518]">
                      Detail Pemeriksaan Itjen
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
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 hover:text-[#071426]"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <div className="relative overflow-hidden rounded-2xl bg-[#071426] p-6 text-white">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#D4A72C]/10 blur-2xl" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Nomor Rekomendasi
                      </p>
                      <p className="mt-2 text-5xl font-bold text-white">
                        #{selected.recommendation_number || 1}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#D4A72C]/30 bg-[#D4A72C]/10 px-3 py-2 text-[10px] font-bold text-[#D4A72C]">
                      ITJEN
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Rekomendasi pemeriksaan Inspektorat Jenderal.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Status Saldo
                  </p>
                  <div className="mt-3">
                    <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                      {selected.saldo_status || "-"}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tindak Lanjut
                  </p>
                  <div className="mt-3">
                    <span
                      className={`inline-flex rounded-lg border px-3 py-2 text-xs font-bold ${getStatusStyle(
                        selected.follow_up_status
                      )}`}
                    >
                      {getStatusLabel(selected.follow_up_status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Informasi Pemeriksaan
                </p>
                <div className="space-y-4">
                  {[
                    ["Nomor LHA / LHP", selected.lha_number],
                    ["Tanggal Pemeriksaan", formatDate(selected.lha_date)],
                    ["Kategori", selected.category],
                    ["No. Temuan", selected.no_temuan],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4"
                    >
                      <span className="text-xs text-slate-400">{label}</span>
                      <span className="text-right text-sm font-semibold text-slate-700">
                        {value || "-"}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4">
                    <span className="text-xs text-slate-400">
                      Sumber Pemeriksaan
                    </span>
                    <span className="rounded-lg bg-[#071426] px-3 py-1.5 text-xs font-bold text-white">
                      ITJEN
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-5">
                    <span className="text-xs text-slate-400">
                      Nomor Rekomendasi
                    </span>
                    <span className="text-right text-sm font-bold text-[#071426]">
                      #{selected.recommendation_number || 1}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Detail Rekomendasi
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold text-slate-400">
                      No. Temuan
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                      {selected.no_temuan || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold text-slate-400">
                      Judul
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                      {selected.judul || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-[10px] font-semibold text-slate-400">
                      Rencana Aksi
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selected.rencana_aksi || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-[10px] font-semibold text-slate-400">
                      Keterangan / Bukti Dukung
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selected.keterangan_bukti_dukung || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold text-slate-400">
                      Waktu Pelaksanaan
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {selected.waktu_pelaksanaan
                        ? formatDate(selected.waktu_pelaksanaan)
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold text-slate-400">
                      UIC
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {selected.uic || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-[10px] font-semibold text-slate-400">
                      Tindak Lanjut
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selected.tindak_lanjut || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => editData(selected)}
                  className="flex-1 rounded-xl bg-[#071426] py-3 text-sm font-bold text-white transition hover:bg-[#10243e] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit Data
                </button>
                <button
                  type="button"
                  onClick={() => void deleteData(selected)}
                  className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                >
                  Hapus Data
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* FORM TAMBAH / EDIT */}
      {showForm && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center py-8">
            <div className="w-full max-w-5xl">
              <RecommendationForm
                onSaved={() => {
                  closeForm();
                  void loadData();
                }}
                editingData={editing}
                onCancelEdit={closeForm}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
