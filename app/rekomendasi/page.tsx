"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import RecommendationForm from "@/components/RecommendationForm";

type Recommendation = {
  id: number;
  source: string;
  category: string;
  lha_number: string;
  lha_date: string;
  recommendation_number: number;
  recommendation_count: number;
  capaian: number;
  follow_up_status: string;
  saldo_status: string;
  temuan?: string | null;
  recommendation?: string | null;
  description: string | null;
  keterangan_1?: string | null;
  keterangan_2?: string | null;
  keterangan_3?: string | null;

  // Kolom revisi
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

type LhpFolder = {
  lha_number: string;
  source: string;
  category: string;
  lha_date: string;
  items: Recommendation[];
  capaian: number;
};
type DocumentFile = {
  id: number;
  recommendation_id: number | null;
  source: string;
  lha_number: string;
  lha_date: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  document_scope: "FOLDER" | "RECOMMENDATION";
  created_at: string;
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

const STATUS_OPTIONS = [
  { value: "ALL", label: "Semua Status" },
  { value: "BELUM_TL", label: "Belum TL" },
  { value: "SUDAH_TL", label: "Sudah TL" },
  { value: "SUDAH_TUNTAS", label: "Sudah Tuntas" },
];

const SALDO_OPTIONS = [
  { value: "ALL", label: "Semua Saldo" },
  { value: "MASUK_SALDO", label: "Masuk Saldo" },
  { value: "BELUM_SALDO", label: "Belum Saldo" },
  { value: "TIDAK_RELEVAN", label: "Tidak Relevan" },
];

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "Semua Kategori" },
  { value: "KEUANGAN", label: "Keuangan" },
  { value: "BUKAN_KEUANGAN", label: "Bukan Keuangan" },
];

function formatDate(date: string) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPercent(value: number) {
  return `${Math.round(Number(value) || 0)}%`;
}

function normalizeStatus(status: string) {
  if (status === "BELUM_TUNTAS") return "SUDAH_TL";
  return status;
}

function getStatusLabel(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "BELUM_TL") return "Belum TL";
  if (normalized === "SUDAH_TL") return "Sudah TL";
  if (normalized === "SUDAH_TUNTAS") return "Sudah Tuntas";

  return status || "-";
}

function getSaldoLabel(status: string) {
  if (status === "MASUK_SALDO") return "Masuk Saldo";
  if (status === "BELUM_SALDO") return "Belum Saldo";
  if (status === "TIDAK_RELEVAN") return "Tidak Relevan";

  return status || "-";
}

function getSourceClass(source: string) {
  if (source === "BPK") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-purple-50 text-purple-700 border-purple-200";
}

function getStatusClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "SUDAH_TUNTAS") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (normalized === "SUDAH_TL") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-orange-50 text-orange-700 border-orange-200";
}

function getSaldoClass(status: string) {
  if (status === "MASUK_SALDO") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (status === "BELUM_SALDO") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  return "bg-gray-50 text-gray-600 border-gray-200";
}

/*
 * Membaca response API dengan aman.
 * Kalau server mengembalikan HTML/error page,
 * kita tampilkan pesan yang lebih jelas daripada
 * "Unexpected token <".
 */
async function readApiJson(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Server mengembalikan respons bukan JSON (${response.status}). ` +
        text.replace(/\s+/g, " ").slice(0, 200)
    );
  }
}

export default function RekomendasiPage() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);

  // Capaian keseluruhan manual yang disimpan di database
  const [manualCapaian, setManualCapaian] = useState(0);
  const [automaticCapaian, setAutomaticCapaian] = useState(0);
  const [indeksCapaian, setIndeksCapaian] = useState(0);

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

  const [detailFolder, setDetailFolder] = useState<LhpFolder | null>(null);

  // Modal edit capaian keseluruhan
  const [showCapaianModal, setShowCapaianModal] = useState(false);
  const [capaianInput, setCapaianInput] = useState("0");
  const [savingCapaian, setSavingCapaian] = useState(false);

  /*
   * LOAD DATA
   */
  const loadData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [recommendationResponse, summaryResponse, capaianResponse] =
        await Promise.all([
          fetch("/api/recommendations", {
            cache: "no-store",
          }),

          fetch("/api/dashboard/summary", {
            cache: "no-store",
          }),

          fetch("/api/dashboard/capaian", {
            cache: "no-store",
          }),
        ]);

      /*
       * RECOMMENDATIONS
       */
      if (!recommendationResponse.ok) {
        const errorJson = await readApiJson(recommendationResponse);

        throw new Error(
          errorJson?.message || "Gagal mengambil data rekomendasi."
        );
      }

      const recommendationJson = await readApiJson(recommendationResponse);

      const recommendationData = Array.isArray(recommendationJson)
        ? recommendationJson
        : recommendationJson?.data ?? recommendationJson?.recommendations ?? [];

      const normalizedData: Recommendation[] = recommendationData.map(
        (item: Recommendation) => ({
          ...item,
          id: Number(item.id),
          capaian: Number(item.capaian) || 0,
          recommendation_number: Number(item.recommendation_number) || 1,
          recommendation_count: Number(item.recommendation_count) || 1,
          follow_up_status: item.follow_up_status || "",
          saldo_status: item.saldo_status || "",
          source: item.source || "",
          category: item.category || "",
          lha_number: item.lha_number || "",
          lha_date: item.lha_date || "",
        })
      );

      setData(normalizedData);

      /*
       * SUMMARY
       */
      if (summaryResponse.ok) {
        const summaryJson = await readApiJson(summaryResponse);

        const summaryData =
          summaryJson?.data ??
          summaryJson?.summary ??
          summaryJson ??
          EMPTY_SUMMARY;

        setSummary({
          ...EMPTY_SUMMARY,
          ...summaryData,
          bpk: {
            ...EMPTY_SUMMARY.bpk,
            ...(summaryData?.bpk ?? {}),
          },
          itjen: {
            ...EMPTY_SUMMARY.itjen,
            ...(summaryData?.itjen ?? {}),
          },
        });
      }

      /*
       * CAPAIAN MANUAL KESELURUHAN
       */
      if (capaianResponse.ok) {
        const capaianJson = await readApiJson(capaianResponse);

        const manualValue = Number(
          capaianJson?.data?.capaian_manual ??
            capaianJson?.data?.capaian ??
            capaianJson?.capaian_manual ??
            capaianJson?.capaian ??
            0
        );

        const automaticValue = Number(capaianJson?.data?.capaian_otomatis ?? 0);

        const indeksValue = Number(capaianJson?.data?.indeks_capaian ?? 0);

        setManualCapaian(Math.max(0, Math.min(100, Number(manualValue) || 0)));

        setAutomaticCapaian(
          Math.max(0, Math.min(1, Number(automaticValue) || 0))
        );

        setIndeksCapaian(Math.max(0, Math.min(1.2, Number(indeksValue) || 0)));
      } else {
        const capaianError = await readApiJson(capaianResponse);

        console.warn("Gagal mengambil capaian manual:", capaianError);
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /*
   * FILTER DATA
   */
  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data.filter((item) => {
      const normalizedItemStatus = normalizeStatus(item.follow_up_status);

      const matchesSearch =
        !keyword ||
        item.lha_number?.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword) ||
        item.source?.toLowerCase().includes(keyword) ||
        item.temuan?.toLowerCase().includes(keyword) ||
        item.recommendation?.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword) ||
        item.keterangan_1?.toLowerCase().includes(keyword) ||
        item.keterangan_2?.toLowerCase().includes(keyword) ||
        item.keterangan_3?.toLowerCase().includes(keyword) ||
        item.no_temuan?.toLowerCase().includes(keyword) ||
        item.judul?.toLowerCase().includes(keyword) ||
        item.rencana_aksi?.toLowerCase().includes(keyword) ||
        item.keterangan_bukti_dukung?.toLowerCase().includes(keyword) ||
        item.uic?.toLowerCase().includes(keyword) ||
        item.tindak_lanjut?.toLowerCase().includes(keyword);

      const matchesSource = source === "ALL" || item.source === source;

      const matchesCategory = category === "ALL" || item.category === category;

      const matchesStatus = status === "ALL" || normalizedItemStatus === status;

      const matchesSaldo = saldo === "ALL" || item.saldo_status === saldo;

      return (
        matchesSearch &&
        matchesSource &&
        matchesCategory &&
        matchesStatus &&
        matchesSaldo
      );
    });
  }, [data, search, source, category, status, saldo]);

  /*
   * GROUPING LHP/LHA
   *
   * Satu nomor LHP/LHA = satu folder.
   */
  const groupedFolders = useMemo<LhpFolder[]>(() => {
    const map = new Map<string, Recommendation[]>();

    filteredData.forEach((item) => {
      const key = item.lha_number?.trim() || `LHA-TANPA-NOMOR-${item.id}`;

      const existing = map.get(key) ?? [];

      existing.push(item);

      map.set(key, existing);
    });

    return Array.from(map.entries()).map(([key, items]) => {
      const sortedItems = [...items].sort(
        (a, b) =>
          (a.recommendation_number || 0) - (b.recommendation_number || 0)
      );

      const totalCapaian = sortedItems.reduce(
        (total, item) => total + (Number(item.capaian) || 0),
        0
      );

      const folderCapaian =
        sortedItems.length > 0 ? totalCapaian / sortedItems.length : 0;

      const first = sortedItems[0];

      return {
        lha_number: key.startsWith("LHA-TANPA-NOMOR-") ? first.lha_number : key,
        source: first.source,
        category: first.category,
        lha_date: first.lha_date,
        items: sortedItems,
        capaian: folderCapaian,
      };
    });
  }, [filteredData]);

  /*
   * CAPAIAN OTOMATIS SESUAI FILTER
   */
  const filteredAutomaticCapaian = useMemo(() => {
    if (filteredData.length === 0) return 0;

    const total = filteredData.reduce(
      (sum, item) => sum + (Number(item.capaian) || 0),
      0
    );

    return total / filteredData.length;
  }, [filteredData]);

  /*
   * STATISTIK FILTER
   */
  const filteredStats = useMemo(() => {
    const total = filteredData.length;

    const belumTl = filteredData.filter(
      (item) => normalizeStatus(item.follow_up_status) === "BELUM_TL"
    ).length;

    const sudahTl = filteredData.filter(
      (item) => normalizeStatus(item.follow_up_status) === "SUDAH_TL"
    ).length;

    const sudahTuntas = filteredData.filter(
      (item) => normalizeStatus(item.follow_up_status) === "SUDAH_TUNTAS"
    ).length;

    const masukSaldo = filteredData.filter(
      (item) => item.saldo_status === "MASUK_SALDO"
    ).length;

    const belumSaldo = filteredData.filter(
      (item) => item.saldo_status === "BELUM_SALDO"
    ).length;

    return {
      total,
      belumTl,
      sudahTl,
      sudahTuntas,
      masukSaldo,
      belumSaldo,
      capaian: filteredAutomaticCapaian,
    };
  }, [filteredData, filteredAutomaticCapaian]);

  /*
   * DELETE
   */
  async function deleteData(item: Recommendation) {
    const confirmed = window.confirm(
      `Hapus rekomendasi #${item.recommendation_number} dari ${item.lha_number}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/recommendations?id=${item.id}`, {
        method: "DELETE",
      });

      const result = await readApiJson(response);

      if (!response.ok) {
        throw new Error(result?.message || "Gagal menghapus data.");
      }

      setDetailFolder(null);

      await loadData(true);
    } catch (err) {
      console.error(err);

      alert(err instanceof Error ? err.message : "Gagal menghapus data.");
    }
  }

  /*
   * EDIT DATA REKOMENDASI
   *
   * Tidak ada edit capaian di sini.
   * Capaian keseluruhan diedit melalui KPI dashboard.
   */
  function editData(item: Recommendation) {
    setDetailFolder(null);
    setEditing(item);
    setShowForm(true);
  }

  /*
   * TAMBAH DATA
   */
  function openAddForm() {
    setEditing(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  /*
   * DETAIL FOLDER
   */
  function openFolder(folder: LhpFolder) {
    setDetailFolder(folder);
  }

  function closeFolder() {
    setDetailFolder(null);
  }

  /*
   * EDIT CAPAIAN KESELURUHAN
   */
  function openCapaianEdit() {
    setCapaianInput(String(manualCapaian));
    setShowCapaianModal(true);
  }

  function closeCapaianEdit() {
    if (savingCapaian) return;

    setShowCapaianModal(false);
    setCapaianInput(String(manualCapaian));
  }

  /*
   * SIMPAN CAPAIAN KESELURUHAN
   */
  async function saveCapaian() {
    let value = Number(capaianInput);

    if (Number.isNaN(value)) {
      alert("Capaian harus berupa angka.");
      return;
    }

    value = Math.max(0, Math.min(100, value));

    try {
      setSavingCapaian(true);

      const response = await fetch("/api/dashboard/capaian", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          capaian_manual: value,
        }),
      });

      const result = await readApiJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message || "Gagal menyimpan capaian keseluruhan."
        );
      }

      const savedValue = Number(
        result?.data?.capaian_manual ?? result?.data?.capaian ?? value
      );

      const safeSavedValue = Math.max(
        0,
        Math.min(100, Number(savedValue) || 0)
      );

      setManualCapaian(safeSavedValue);
      setShowCapaianModal(false);
      setCapaianInput(String(safeSavedValue));

      await loadData(true);
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan capaian keseluruhan."
      );
    } finally {
      setSavingCapaian(false);
    }
  }

  /*
   * RESET FILTER
   */
  function resetFilters() {
    setSearch("");
    setSource("ALL");
    setCategory("ALL");
    setStatus("ALL");
    setSaldo("ALL");
  }

  const hasFilter =
    Boolean(search) ||
    source !== "ALL" ||
    category !== "ALL" ||
    status !== "ALL" ||
    saldo !== "ALL";

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* HEADER */}
        <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                Monitoring APF
              </div>

              <h1 className="text-2xl font-bold md:text-3xl">
                Dashboard Monitoring Rekomendasi
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-200">
                Kelola LHP/LHA sebagai folder yang berisi satu atau beberapa
                rekomendasi. Capaian rekomendasi dihitung oleh sistem, sedangkan
                capaian keseluruhan dapat ditentukan secara manual.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openAddForm}
                className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                + Tambah LHP / LHA
              </button>
            </div>
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">Terjadi kesalahan</div>

            <div className="mt-1">{error}</div>

            <button
              type="button"
              onClick={() => loadData(true)}
              className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* KPI */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            title="Total Rekomendasi"
            value={summary.total || data.length}
            description={`${groupedFolders.length} folder LHP/LHA`}
            icon="📋"
          />

          <KpiCard
            title="Belum TL"
            value={summary.belumTl || filteredStats.belumTl}
            description="Masih membutuhkan tindak lanjut"
            icon="⏳"
          />

          <KpiCard
            title="Sudah TL"
            value={summary.sudahTl || filteredStats.sudahTl}
            description="Sudah dilakukan tindak lanjut"
            icon="🔄"
          />

          <KpiCard
            title="Sudah Tuntas"
            value={summary.sudahTuntas || filteredStats.sudahTuntas}
            description="Rekomendasi telah tuntas"
            icon="✅"
          />

          {/* CAPAIAN OTOMATIS */}
          <KpiCard
            title="Capaian"
            value={formatPercent(automaticCapaian * 100)}
            description="Hasil perhitungan Sistem"
            icon="📈"
          />

          {/* CAPAIAN MANUAL */}
          <KpiCard
            title="Capaian"
            value={
              <div className="flex items-center gap-2">
                <span>{formatPercent(manualCapaian)}</span>

                <button
                  type="button"
                  onClick={openCapaianEdit}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100"
                >
                  Edit
                </button>
              </div>
            }
            description="Nilai keseluruhan"
            icon="🎯"
          />
        </section>

        {/* BPK + ITJEN */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SummaryPanel
            title="BPK"
            icon="🏛️"
            total={summary.bpk.total}
            items={[
              {
                label: "Masuk Saldo",
                value: summary.bpk.masukSaldo,
              },
              {
                label: "Belum Saldo",
                value: summary.bpk.belumSaldo,
              },
              {
                label: "Keuangan",
                value: summary.bpk.keuangan,
              },
              {
                label: "Bukan Keuangan",
                value: summary.bpk.bukanKeuangan,
              },
            ]}
          />

          <SummaryPanel
            title="ITJEN"
            icon="🛡️"
            total={summary.itjen.total}
            items={[
              {
                label: "Belum TL",
                value: summary.itjen.belumTl,
              },
              {
                label: "Sudah TL",
                value: summary.itjen.sudahTl,
              },
              {
                label: "Sudah Tuntas",
                value: summary.itjen.sudahTuntas,
              },
            ]}
          />
        </section>

        {/* FILTER */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Filter Data
              </h2>

              <p className="text-xs text-slate-500">
                Cari LHP/LHA atau rekomendasi tertentu.
              </p>
            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className={labelClass}>Cari</label>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari LHA, No Temuan, Judul, UIC, tindak lanjut..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Sumber</label>

              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className={selectClass}
              >
                <option value="ALL">Semua Sumber</option>

                <option value="BPK">BPK</option>

                <option value="ITJEN">ITJEN</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Kategori</label>

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={selectClass}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Status</label>

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Status Saldo</label>

              <select
                value={saldo}
                onChange={(event) => setSaldo(event.target.value)}
                className={selectClass}
              >
                {SALDO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <div className="w-full rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Hasil Filter</div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-900">
                    {groupedFolders.length} LHP/LHA
                  </span>

                  <span className="text-slate-300">•</span>

                  <span className="font-semibold text-slate-700">
                    {filteredData.length} rekomendasi
                  </span>

                  <span className="text-slate-300">•</span>

                  <span className="font-semibold text-blue-700">
                    Capaian {formatPercent(filteredStats.capaian)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TABLE FOLDER */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Folder LHP / LHA
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Setiap nomor LHP/LHA ditampilkan sebagai satu folder yang berisi
                beberapa rekomendasi.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? "Memuat..." : "↻ Refresh"}
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : groupedFolders.length === 0 ? (
            <EmptyState
              hasFilter={hasFilter}
              onReset={resetFilters}
              onAdd={openAddForm}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4 font-semibold">No</th>

                    <th className="px-5 py-4 font-semibold">Sumber</th>

                    <th className="px-5 py-4 font-semibold">LHA / LHP</th>

                    <th className="px-5 py-4 font-semibold">Tanggal</th>

                    <th className="px-5 py-4 text-center font-semibold">
                      Jumlah Rek.
                    </th>

                    <th className="px-5 py-4 font-semibold">Capaian</th>

                    <th className="px-5 py-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {groupedFolders.map((folder, index) => (
                    <tr
                      key={`${folder.source}-${folder.lha_number}`}
                      onClick={() => openFolder(folder)}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/50"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getSourceClass(
                            folder.source
                          )}`}
                        >
                          {folder.source}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg">
                            📁
                          </div>

                          <div>
                            <div className="font-bold text-slate-900">
                              {folder.lha_number}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {folder.category || "Tanpa kategori"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(folder.lha_date)}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-[70px] items-center justify-center rounded-full bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                          {folder.items.length} Rek.
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-[140px]">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">
                              Capaian
                            </span>

                            <span className="text-sm font-bold text-slate-900">
                              {formatPercent(folder.capaian)}
                            </span>
                          </div>

                          <ProgressBar value={folder.capaian} />
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openFolder(folder);
                          }}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-800"
                        >
                          Buka Folder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
              <span className="text-slate-500">
                Menampilkan{" "}
                <strong className="text-slate-900">
                  {groupedFolders.length}
                </strong>{" "}
                folder LHP/LHA dengan{" "}
                <strong className="text-slate-900">
                  {filteredData.length}
                </strong>{" "}
                rekomendasi.
              </span>

              <span className="font-bold text-blue-700">
                Capaian Filter: {formatPercent(filteredAutomaticCapaian)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================
          FORM TAMBAH / EDIT
      ===================================================== */}

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center py-8">
            <div className="w-full max-w-5xl">
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

      {/* =====================================================
          DETAIL FOLDER
      ===================================================== */}

      {detailFolder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-2xl">📁</span>

                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                      Detail Folder
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900">
                    {detailFolder.lha_number}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {detailFolder.source} • {detailFolder.category} •{" "}
                    {formatDate(detailFolder.lha_date)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeFolder}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-500 hover:bg-slate-50"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {/* INFO FOLDER */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniStat label="Sumber" value={detailFolder.source} />

                <MiniStat
                  label="Jumlah Rek."
                  value={`${detailFolder.items.length}`}
                />

                <MiniStat
                  label="Tanggal"
                  value={formatDate(detailFolder.lha_date)}
                />

                <MiniStat
                  label="Capaian"
                  value={formatPercent(detailFolder.capaian)}
                />
              </div>

              {/* CAPAIAN FOLDER */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-blue-900">
                      Capaian LHP / LHA
                    </div>

                    <div className="mt-1 text-xs text-blue-700">
                      Dihitung otomatis dari rata-rata capaian seluruh
                      rekomendasi di folder ini.
                    </div>
                  </div>

                  <div className="text-3xl font-black text-blue-700">
                    {formatPercent(detailFolder.capaian)}
                  </div>
                </div>

                <div className="mt-4">
                  <ProgressBar value={detailFolder.capaian} />
                </div>
              </div>
              {/* DOKUMEN FOLDER */}
              <DocumentManager
                scope="FOLDER"
                source={detailFolder.source}
                lhaNumber={detailFolder.lha_number}
                lhaDate={detailFolder.lha_date}
              />

              {/* DAFTAR REKOMENDASI */}
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-900">
                    Daftar Rekomendasi
                  </h3>

                  <p className="text-sm text-slate-500">
                    Nilai capaian rekomendasi ditampilkan sebagai bagian dari
                    perhitungan sistem.
                  </p>
                </div>

                <div className="space-y-4">
                  {detailFolder.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
                            {item.recommendation_number || index + 1}
                          </div>

                          <div>
                            <div className="font-bold text-slate-900">
                              Rekomendasi #
                              {item.recommendation_number || index + 1}
                            </div>

                            <div className="text-xs text-slate-500">
                              ID Data: {item.id}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                              item.follow_up_status
                            )}`}
                          >
                            {getStatusLabel(item.follow_up_status)}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSaldoClass(
                              item.saldo_status
                            )}`}
                          >
                            {getSaldoLabel(item.saldo_status)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <DetailBox title="No Temuan" value={item.no_temuan} />

                          <DetailBox title="Judul" value={item.judul} />

                          <DetailBox
                            title="Rencana Aksi"
                            value={item.rencana_aksi}
                          />

                          <DetailBox
                            title="Keterangan / Bukti Dukung"
                            value={item.keterangan_bukti_dukung}
                          />

                          <DetailBox
                            title="Waktu Pelaksanaan"
                            value={formatDate(item.waktu_pelaksanaan || "")}
                          />

                          <DetailBox title="UIC" value={item.uic} />

                          <div className="md:col-span-2">
                            <DetailBox
                              title="Tindak Lanjut"
                              value={item.tindak_lanjut}
                            />
                          </div>
                        </div>

                        {/* CAPAIAN REKOMENDASI */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                Capaian Rekomendasi
                              </div>

                              <div className="text-xs text-slate-500">
                                Nilai yang digunakan dalam perhitungan sistem.
                              </div>
                            </div>

                            <div className="text-xl font-black text-blue-700">
                              {formatPercent(item.capaian)}
                            </div>
                          </div>

                          <ProgressBar value={item.capaian} />
                        </div>
                        {/* DOKUMEN REKOMENDASI */}
                        <DocumentManager
                          scope="RECOMMENDATION"
                          source={detailFolder.source}
                          lhaNumber={detailFolder.lha_number}
                          lhaDate={detailFolder.lha_date}
                          recommendationId={item.id}
                        />

                        {/* AKSI */}
                        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => editData(item)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Edit Data
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteData(item)}
                            className="rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL EDIT CAPAIAN KESELURUHAN
      ===================================================== */}

      {showCapaianModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Edit Capaian
              </div>

              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Capaian Keseluruhan
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Nilai ini berlaku untuk keseluruhan dashboard.
              </p>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Capaian (%)
            </label>

            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={capaianInput}
                onChange={(event) => setCapaianInput(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-lg font-bold text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                %
              </span>
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Nilai dibatasi antara 0 sampai 100%. Nilai ini disimpan ke
              database dan tidak mengubah capaian setiap rekomendasi.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCapaianEdit}
                disabled={savingCapaian}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={saveCapaian}
                disabled={savingCapaian}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCapaian ? "Menyimpan..." : "Simpan Capaian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const labelClass =
  "mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500";

function KpiCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: ReactNode;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {title}
          </div>

          <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function SummaryPanel({
  title,
  icon,
  total,
  items,
}: {
  title: string;
  icon: string;
  total: number;
  items: {
    label: string;
    value: number;
  }[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
            {icon}
          </div>

          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>

            <p className="text-xs text-slate-500">Total {total} rekomendasi</p>
          </div>
        </div>

        <div className="text-2xl font-black text-slate-900">{total}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">{item.label}</div>

            <div className="mt-1 text-xl font-black text-slate-900">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-blue-600 transition-all duration-500"
        style={{
          width: `${safeValue}%`,
        }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>

      <div className="mt-1 font-bold text-slate-900">{value}</div>
    </div>
  );
}

function DetailBox({ title, value }: { title: string; value?: string | null }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
        {title}
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {value?.trim() || "-"}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

        <p className="mt-4 text-sm font-semibold text-slate-600">
          Memuat data...
        </p>
      </div>
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
    <div className="flex min-h-[320px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
          📁
        </div>

        <h3 className="mt-5 text-lg font-bold text-slate-900">
          Belum ada folder LHP/LHA
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {hasFilter
            ? "Tidak ada data yang sesuai dengan filter yang dipilih."
            : "Tambahkan LHP/LHA baru untuk mulai memasukkan rekomendasi."}
        </p>

        <div className="mt-5 flex justify-center gap-3">
          {hasFilter && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset Filter
            </button>
          )}

          <button
            type="button"
            onClick={onAdd}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
          >
            + Tambah LHP / LHA
          </button>
        </div>
      </div>
    </div>
  );
}
function DocumentManager({
  scope,
  source,
  lhaNumber,
  lhaDate,
  recommendationId,
}: {
  scope: "FOLDER" | "RECOMMENDATION";
  source: string;
  lhaNumber: string;
  lhaDate?: string | null;
  recommendationId?: number;
}) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      params.set("scope", scope);

      if (scope === "RECOMMENDATION" && recommendationId) {
        params.set("recommendationId", String(recommendationId));
      }

      if (scope === "FOLDER") {
        params.set("source", source);
        params.set("lhaNumber", lhaNumber);

        if (lhaDate) {
          params.set("lhaDate", lhaDate);
        }
      }

      const response = await fetch(`/api/documents?${params.toString()}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Gagal mengambil dokumen");
      }

      setDocuments(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Load documents error:", error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [scope, source, lhaNumber, lhaDate, recommendationId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedExtensions = [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
    ];

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !allowedExtensions.includes(extension)) {
      alert(
        "Format file tidak diperbolehkan.\n\nGunakan: PDF, DOC, DOCX, XLS, XLSX, PPT, atau PPTX."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("Ukuran file maksimal 20 MB.");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();

      formData.append("file", file);
      formData.append("source", source);
      formData.append("lhaNumber", lhaNumber);
      formData.append("documentScope", scope);

      if (lhaDate) {
        formData.append("lhaDate", lhaDate);
      }

      if (scope === "RECOMMENDATION" && recommendationId) {
        formData.append("recommendationId", String(recommendationId));
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Gagal mengupload dokumen");
      }

      await loadDocuments();

      alert("Dokumen berhasil diupload.");
    } catch (error) {
      console.error("Upload document error:", error);

      alert(
        error instanceof Error ? error.message : "Gagal mengupload dokumen."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin menghapus dokumen ini?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Gagal menghapus dokumen");
      }

      await loadDocuments();
    } catch (error) {
      console.error("Delete document error:", error);

      alert(
        error instanceof Error ? error.message : "Gagal menghapus dokumen."
      );
    }
  };

  const formatFileSize = (size: number | null) => {
    if (!size) return "-";

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📎</span>

            <h4 className="text-sm font-semibold text-slate-800">
              {scope === "FOLDER"
                ? "Dokumen Folder / LHP"
                : "Dokumen Rekomendasi"}
            </h4>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Upload dokumen pendukung secara opsional.
          </p>
        </div>

        <label
          className={`inline-flex cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white transition ${
            uploading
              ? "cursor-not-allowed bg-slate-400"
              : "bg-slate-800 hover:bg-slate-700"
          }`}
        >
          {uploading ? "Mengupload..." : "+ Upload Dokumen"}

          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-slate-500">
          Memuat dokumen...
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center">
          <div className="text-2xl">📄</div>

          <p className="mt-2 text-xs font-medium text-slate-600">
            Belum ada dokumen
          </p>

          <p className="mt-1 text-[11px] text-slate-400">
            Dokumen dapat diupload kapan saja.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold uppercase text-slate-600">
                  {document.file_type || "DOC"}
                </div>

                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium text-slate-700"
                    title={document.file_name}
                  >
                    {document.file_name}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatFileSize(document.file_size)} •{" "}
                    {new Date(document.created_at).toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={document.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Buka
                </a>

                <button
                  type="button"
                  onClick={() => handleDelete(document.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-slate-400">
        Format: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX • Maksimal 20 MB
      </p>
    </div>
  );
}
