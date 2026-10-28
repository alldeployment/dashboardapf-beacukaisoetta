"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  recommendation_number?: number | null;
  temuan?: string | null;
  recommendation?: string | null;
  keterangan_1?: string | null;
  keterangan_2?: string | null;
  keterangan_3?: string | null;
  no_temuan?: string | null;
  judul?: string | null;
  rencana_aksi?: string | null;
  keterangan_bukti_dukung?: string | null;
  waktu_pelaksanaan?: string | null;
  uic?: string | null;
  tindak_lanjut?: string | null;
  capaian?: number | null;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const [yearReady, setYearReady] = useState(false);
  const [capaianData, setCapaianData] = useState<{
    capaian_manual: number;
    capaian_otomatis: number;
    indeks_capaian: number;
    indeks_capaian_manual: number;
    indeks_capaian_otomatis: number;
    indeks_capaian_mode: "MANUAL" | "OTOMATIS";
    persentase_saldo?: number;
    rumus?: {
      rumus_capaian?: string;
      rumus_indeks?: string;
      rumus_persentase_saldo?: string;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [yearInput, setYearInput] = useState("2026");
  const [rumusCapaian, setRumusCapaian] = useState(
    "((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo"
  );

  const [rumusPersentaseSaldo, setRumusPersentaseSaldo] = useState(
    "((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo"
  );

  const [rumusIndeks, setRumusIndeks] = useState(
    "min(capaian / 81 * 100, 120%)"
  );

  const [showIndeksRumusModal, setShowIndeksRumusModal] = useState(false);

  const [showCapaianRumusModal, setShowCapaianRumusModal] = useState(false);
  const [showSaldoRumusModal, setShowSaldoRumusModal] = useState(false);
  const [saldoFilter, setSaldoFilter] = useState<
    "MASUK_SALDO" | "BELUM_SALDO" | null
  >(null);

  const [selectedSaldoRecommendation, setSelectedSaldoRecommendation] =
    useState<Recommendation | null>(null);
  const [editingSaldoRecommendation, setEditingSaldoRecommendation] =
    useState<Recommendation | null>(null);

  const [savingSaldoEdit, setSavingSaldoEdit] = useState(false);

  const [deletingSaldoId, setDeletingSaldoId] = useState<number | null>(null);

  const [savingRumus, setSavingRumus] = useState(false);

  const loadDashboard = useCallback(async (year: number) => {
    try {
      setLoading(true);
      setError("");

      const query = `?year=${year}`;

      const [summaryRes, recommendationRes, capaianRes] = await Promise.all([
        fetch(`/api/dashboard/summary${query}`, {
          cache: "no-store",
        }),
        fetch(`/api/recommendations${query}`, {
          cache: "no-store",
        }),
        fetch(`/api/dashboard/capaian${query}`, {
          cache: "no-store",
        }),
      ]);

      const summaryJson = await summaryRes.json();
      const recommendationJson = await recommendationRes.json();
      const capaianJson = await capaianRes.json();

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

      if (!capaianRes.ok || !capaianJson?.ok) {
        throw new Error(
          [
            capaianJson?.message || "Gagal mengambil data capaian",
            capaianJson?.error || "",
          ]
            .filter(Boolean)
            .join(" - ")
        );
      }
      setSummary(summaryJson.data ?? null);
      setRecommendations(recommendationJson.data ?? []);
      setCapaianData(capaianJson.data ?? null);
      const savedRumus = capaianJson.data?.rumus;

      if (savedRumus) {
        setRumusCapaian(
          savedRumus.rumus_capaian ??
            "((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo"
        );

        setRumusPersentaseSaldo(
          savedRumus.rumus_persentase_saldo ??
            "((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo"
        );
        setRumusIndeks(savedRumus.rumus_indeks ?? "min(capaian / 0.62, 1.2)");
      }
    } catch (err) {
      console.error("DASHBOARD ERROR:", err);

      setError(
        err instanceof Error ? err.message : "Data dashboard gagal dimuat."
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const yearParam = params.get("year");
    const savedYear = localStorage.getItem("apfMonitoringYear");

    const isValidYear = (value: string | null) => {
      if (!value || !/^\d{4}$/.test(value)) return false;

      const year = Number(value);
      return year >= 2026 && year <= 9998;
    };

    const yearToUse = isValidYear(yearParam)
      ? yearParam!
      : isValidYear(savedYear)
      ? savedYear!
      : "2026";

    setSelectedYear(Number(yearToUse));
    setYearInput(yearToUse);

    localStorage.setItem("apfMonitoringYear", yearToUse);

    setYearReady(true);
  }, []);
  useEffect(() => {
    if (!yearReady) return;

    void loadDashboard(selectedYear);

    const interval = setInterval(() => {
      void loadDashboard(selectedYear);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedYear, loadDashboard, yearReady]);
  async function saveRumus(type: "CAPAIAN" | "SALDO" | "INDEKS") {
    const formula =
      type === "CAPAIAN"
        ? rumusCapaian
        : type === "SALDO"
        ? rumusPersentaseSaldo
        : rumusIndeks;

    if (!formula.trim()) {
      alert("Rumus tidak boleh kosong.");
      return;
    }

    try {
      setSavingRumus(true);

      const body =
        type === "CAPAIAN"
          ? {
              year: selectedYear,
              rumus_capaian: formula.trim(),
            }
          : type === "SALDO"
          ? {
              year: selectedYear,
              rumus_persentase_saldo: formula.trim(),
            }
          : {
              year: selectedYear,
              rumus_indeks: formula.trim(),
            };

      const response = await fetch("/api/dashboard/capaian", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || "Gagal menyimpan rumus.");
      }

      if (type === "CAPAIAN") {
        setShowCapaianRumusModal(false);
      } else if (type === "SALDO") {
        setShowSaldoRumusModal(false);
      } else {
        setShowIndeksRumusModal(false);
      }

      await loadDashboard(selectedYear);
      alert("Rumus berhasil disimpan.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan rumus.");
    } finally {
      setSavingRumus(false);
    }
  }
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "SUDAH_TUNTAS":
        return "Sudah Tuntas";

      case "SUDAH_TL":
        return "Sudah TL";

      case "BELUM_TL":
        return "Belum TL";

      default:
        return status ? status.replaceAll("_", " ") : "-";
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

  const totalRekomendasiBersaldo = masukSaldoGlobal + belumSaldoGlobal;

  const persentaseSaldoGlobal = safePercentage(
    masukSaldoGlobal,
    totalRekomendasiBersaldo
  );

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
  const normalizeFollowUpStatus = (value: string) => {
    const status = (value ?? "").trim().toUpperCase();

    if (status === "BELUM_TUNTAS" || status === "TL_BELUM_TUNTAS") {
      return "SUDAH_TL";
    }

    if (status === "TL_SUDAH_TUNTAS") {
      return "SUDAH_TUNTAS";
    }

    return status;
  };

  const bpkRecommendations = recommendations.filter(
    (item) => (item.source ?? "").trim().toUpperCase() === "BPK"
  );

  const bpkData = {
    total: bpkRecommendations.length,

    masukSaldo: bpkRecommendations.filter(
      (item) => (item.saldo_status ?? "").trim().toUpperCase() === "MASUK_SALDO"
    ).length,

    belumSaldo: bpkRecommendations.filter(
      (item) => (item.saldo_status ?? "").trim().toUpperCase() === "BELUM_SALDO"
    ).length,

    keuangan: bpkRecommendations.filter(
      (item) => (item.category ?? "").trim().toUpperCase() === "KEUANGAN"
    ).length,

    bukanKeuangan: bpkRecommendations.filter(
      (item) => (item.category ?? "").trim().toUpperCase() === "BUKAN_KEUANGAN"
    ).length,

    belumTl: bpkRecommendations.filter(
      (item) => normalizeFollowUpStatus(item.follow_up_status) === "BELUM_TL"
    ).length,

    sudahTl: bpkRecommendations.filter(
      (item) => normalizeFollowUpStatus(item.follow_up_status) === "SUDAH_TL"
    ).length,

    sudahTuntas: bpkRecommendations.filter(
      (item) =>
        normalizeFollowUpStatus(item.follow_up_status) === "SUDAH_TUNTAS"
    ).length,
  };

  const persentaseSaldo = safePercentage(bpkData.masukSaldo, bpkData.total);

  const persentaseBelumSaldo = safePercentage(
    bpkData.belumSaldo,
    bpkData.total
  );
  const persentaseBpkBelumTl = safePercentage(bpkData.belumTl, bpkData.total);

  const persentaseBpkSudahTl = safePercentage(bpkData.sudahTl, bpkData.total);

  const persentaseBpkSudahTuntas = safePercentage(
    bpkData.sudahTuntas,
    bpkData.total
  );
  // RINGKASAN STATUS SALDO ITJEN
  const itjenRecommendationsBySource = recommendations.filter(
    (item) => (item.source ?? "").trim().toUpperCase() === "ITJEN"
  );
  console.log(
    "DATA KATEGORI ITJEN:",
    itjenRecommendationsBySource.map((item) => ({
      id: item.id,
      source: item.source,
      category: item.category,
      description: item.description,
    }))
  );
  const itjenSaldoData = {
    masukSaldo: itjenRecommendationsBySource.filter(
      (item) => (item.saldo_status ?? "").trim().toUpperCase() === "MASUK_SALDO"
    ).length,

    belumSaldo: itjenRecommendationsBySource.filter(
      (item) => (item.saldo_status ?? "").trim().toUpperCase() === "BELUM_SALDO"
    ).length,
  };
  const persentaseSaldoItjen = safePercentage(
    itjenSaldoData.masukSaldo,
    itjenRecommendationsBySource.length
  );

  const persentaseBelumSaldoItjen = safePercentage(
    itjenSaldoData.belumSaldo,
    itjenRecommendationsBySource.length
  );
  /*
  ============================================================
  ITJEN
  ============================================================
  */

  const itjenData = {
    total: itjenRecommendationsBySource.length,
    laporanKeuangan: itjenRecommendationsBySource.filter((item) => {
      const category = (item.category ?? "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");

      return category === "KEUANGAN" || category === "LAPORAN_KEUANGAN";
    }).length,

    bukanKeuangan: itjenRecommendationsBySource.filter(
      (item) =>
        (item.category ?? "")
          .trim()
          .toUpperCase()
          .replace(/[\s-]+/g, "_") === "BUKAN_KEUANGAN"
    ).length,

    tindakPemeriksaan: itjenRecommendationsBySource.filter((item) => {
      const category = (item.category ?? "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");

      return (
        category === "TINDAK_PEMERIKSAAN" ||
        category === "TINDAK_LANJUT_PEMERIKSAAN"
      );
    }).length,

    belumTl: itjenRecommendationsBySource.filter(
      (item) => normalizeFollowUpStatus(item.follow_up_status) === "BELUM_TL"
    ).length,

    sudahTl: itjenRecommendationsBySource.filter(
      (item) => normalizeFollowUpStatus(item.follow_up_status) === "SUDAH_TL"
    ).length,

    sudahTuntas: itjenRecommendationsBySource.filter(
      (item) =>
        normalizeFollowUpStatus(item.follow_up_status) === "SUDAH_TUNTAS"
    ).length,
  };
  const persentaseTuntas = safePercentage(
    itjenData.sudahTuntas,
    itjenData.total
  );

  const persentaseSudahTl = safePercentage(itjenData.sudahTl, itjenData.total);

  const persentaseBelumTl = safePercentage(itjenData.belumTl, itjenData.total);

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
  const saldoRecommendations = recommendations.filter((item) => {
    const status = (item.saldo_status ?? "").trim().toUpperCase();

    return saldoFilter !== null && status === saldoFilter;
  });
  function updateSaldoEdit<K extends keyof Recommendation>(
    key: K,
    value: Recommendation[K]
  ) {
    setEditingSaldoRecommendation((previous) =>
      previous ? { ...previous, [key]: value } : previous
    );
  }

  async function saveSaldoEdit() {
    const item = editingSaldoRecommendation;
    if (!item) return;

    if (
      !item.source.trim() ||
      !item.category.trim() ||
      !item.lha_number.trim() ||
      !item.lha_date ||
      !item.follow_up_status ||
      !item.saldo_status
    ) {
      alert("Sumber, kategori, nomor LHA, tanggal, dan status wajib diisi.");
      return;
    }

    try {
      setSavingSaldoEdit(true);

      const response = await fetch("/api/recommendations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          source: item.source,
          category: item.category,
          lhaNumber: item.lha_number,
          lhaDate: item.lha_date.slice(0, 10),
          recommendationNumber: item.recommendation_number ?? null,
          temuan: item.temuan ?? "",
          recommendation: item.recommendation ?? "",
          description: item.description ?? "",
          keterangan_1: item.keterangan_1 ?? "",
          keterangan_2: item.keterangan_2 ?? "",
          keterangan_3: item.keterangan_3 ?? "",
          no_temuan: item.no_temuan ?? "",
          judul: item.judul ?? "",
          rencana_aksi: item.rencana_aksi ?? "",
          keterangan_bukti_dukung: item.keterangan_bukti_dukung ?? "",
          waktu_pelaksanaan: item.waktu_pelaksanaan || null,
          uic: item.uic ?? "",
          tindak_lanjut: item.tindak_lanjut ?? "",
          followUpStatus: item.follow_up_status,
          saldoStatus: item.saldo_status,
        }),
      });

      const result = await response.json();

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || "Gagal mengubah rekomendasi.");
      }

      setEditingSaldoRecommendation(null);
      setSelectedSaldoRecommendation(null);

      await loadDashboard(selectedYear);
      alert("Rekomendasi berhasil diperbarui.");
    } catch (err) {
      console.error("EDIT REKOMENDASI:", err);
      alert(err instanceof Error ? err.message : "Gagal mengubah rekomendasi.");
    } finally {
      setSavingSaldoEdit(false);
    }
  }

  async function deleteSaldoRecommendation(item: Recommendation) {
    const confirmed = window.confirm(
      `Yakin menghapus rekomendasi #${
        item.recommendation_number ?? item.id
      } dari LHA ${item.lha_number || "-"}?`
    );

    if (!confirmed) return;

    try {
      setDeletingSaldoId(item.id);

      const response = await fetch(
        `/api/recommendations?id=${encodeURIComponent(String(item.id))}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || "Gagal menghapus rekomendasi.");
      }

      setSelectedSaldoRecommendation(null);
      await loadDashboard(selectedYear);
      alert("Rekomendasi berhasil dihapus.");
    } catch (err) {
      console.error("HAPUS REKOMENDASI:", err);
      alert(
        err instanceof Error ? err.message : "Gagal menghapus rekomendasi."
      );
    } finally {
      setDeletingSaldoId(null);
    }
  }
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

      <div className="relative min-h-screen bg-white/5 px-6 py-8 lg:px-8">
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

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="dashboard-year"
                  className="text-xs font-semibold text-white/70"
                >
                  Tahun Periode
                </label>

                <input
                  id="dashboard-year"
                  type="number"
                  min={2026}
                  max={9998}
                  step={1}
                  value={yearInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setYearInput(value);

                    if (/^\d{4}$/.test(value)) {
                      const year = Number(value);

                      if (year >= 2026 && year <= 9998) {
                        setSelectedYear(year);

                        localStorage.setItem("apfMonitoringYear", String(year));

                        const params = new URLSearchParams(
                          window.location.search
                        );
                        params.set("year", String(year));

                        router.replace(`${pathname}?${params.toString()}`, {
                          scroll: false,
                        });
                      }
                    }
                  }}
                  onBlur={() => {
                    const year = Number(yearInput);

                    if (
                      !/^\d{4}$/.test(yearInput) ||
                      !Number.isInteger(year) ||
                      year < 2026 ||
                      year > 9998
                    ) {
                      setYearInput(String(selectedYear));
                    }
                  }}
                  className="min-w-[150px] rounded-xl border border-white/20 bg-[#10243D] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-[#D4A72C]"
                />
              </div>

              <Link
                href={`/rekomendasi?year=${selectedYear}`}
                className="rounded-xl bg-[#D4A72C] px-5 py-3 text-sm font-semibold text-[#071426] shadow-lg transition hover:bg-[#E5BA45]"
              >
                + Tambah Rekomendasi
              </Link>

              <Link
                href={`/laporan?year=${selectedYear}`}
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

        {/* CAPAIAN KESELURUHAN */}
        <section className="mb-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* CAPAIAN OTOMATIS BERDASARKAN RUMUS */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white via-white to-sky-50 p-6 shadow-xl transition duration-300 hover:shadow-2xl">
              {/* AKSEN DEKORATIF */}
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />

              <div className="relative z-10 flex h-full flex-col justify-between gap-7">
                {/* HEADER */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />

                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
                        Capaian Otomatis
                      </span>
                    </div>

                    <h3 className="text-lg font-bold tracking-tight text-[#071426]">
                      Hasil Perhitungan Sistem
                    </h3>

                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Berdasarkan perhitungan capaian rekomendasi yang diterima
                      dari sistem.
                    </p>
                  </div>

                  {/* NILAI PERSENTASE */}
                  <div className="min-w-[112px] rounded-2xl border border-blue-200/80 bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Capaian Saat Ini
                    </p>

                    <p className="mt-1 text-3xl font-extrabold tracking-tight text-blue-600">
                      {loading ? "—" : `${capaianPersen}%`}
                    </p>
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Progres Capaian
                    </span>

                    <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold text-blue-700">
                      Skala 0–100%
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 p-[2px]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400 transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(0, capaianPersen))}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* INDEKS CAPAIAN */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-white via-white to-amber-50 p-6 shadow-xl transition duration-300 hover:shadow-2xl">
              {/* AKSEN DEKORATIF */}
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#D4A72C]/10 blur-2xl" />

              <div className="relative z-10 flex h-full flex-col justify-between gap-7">
                {/* HEADER */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />

                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9B7518]">
                        Capaian Keseluruhan
                      </span>
                    </div>

                    <h3 className="text-lg font-bold tracking-tight text-[#071426]">
                      Indeks Capaian Tindak Lanjut
                    </h3>

                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Nilai indeks berdasarkan rumus yang tersimpan pada sistem.
                    </p>
                  </div>

                  {/* NILAI INDEKS */}
                  {/* PENGATURAN DAN NILAI INDEKS */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIndeksRumusModal(true)}
                      disabled={savingRumus}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                    >
                      Atur Rumus
                    </button>

                    <div className="min-w-[112px] rounded-2xl border border-amber-200/80 bg-white/90 px-4 py-3 shadow-sm">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Nilai Indeks
                      </p>

                      <p className="mt-1 text-3xl font-extrabold tracking-tight text-[#9B7518]">
                        {loading ? "—" : `${indeksCapaianPersen}%`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PROGRESS INDEKS */}
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Progres Indeks
                    </span>

                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-[#8A6810]">
                      Skala 0–120%
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 p-[2px]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#B88912] via-[#D4A72C] to-[#F0C85A] transition-all duration-700 ease-out"
                      style={{
                        width: `${(indeksCapaianBar / 120) * 100}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                    <span>0%</span>
                    <span>120%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATUS SALDO SELURUH REKOMENDASI */}
        <section className="mb-8">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F0C85A]">
              Ringkasan Saldo
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              Status Saldo Seluruh Rekomendasi
            </h2>

            <p className="mt-1 text-sm text-white/70">
              Rekapitulasi saldo dan indeks capaian tindak lanjut rekomendasi
              BPK dan ITJEN.
            </p>
          </div>

          {/* GRID EMPAT KARTU */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* MASUK SALDO */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setSaldoFilter("MASUK_SALDO");
                setSelectedSaldoRecommendation(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSaldoFilter("MASUK_SALDO");
                  setSelectedSaldoRecommendation(null);
                }
              }}
              className="flex min-h-[155px] cursor-pointer flex-col justify-between rounded-2xl border border-green-200/70 bg-white p-5 text-left shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-green-700">
                  Masuk Saldo
                </p>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-lg font-bold text-green-600">
                  ✓
                </div>
              </div>

              <div>
                <p className="text-3xl font-bold tracking-tight text-green-600">
                  {loading ? "—" : masukSaldoGlobal.toLocaleString("id-ID")}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Total rekomendasi yang masuk saldo
                </p>
              </div>
            </div>

            {/* BELUM MASUK SALDO */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setSaldoFilter("BELUM_SALDO");
                setSelectedSaldoRecommendation(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSaldoFilter("BELUM_SALDO");
                  setSelectedSaldoRecommendation(null);
                }
              }}
              className="flex min-h-[155px] cursor-pointer flex-col justify-between rounded-2xl border border-orange-200/70 bg-white p-5 text-left shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
                  Belum Masuk Saldo
                </p>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-lg font-bold text-orange-600">
                  !
                </div>
              </div>

              <div>
                <p className="text-3xl font-bold tracking-tight text-orange-600">
                  {loading ? "—" : belumSaldoGlobal.toLocaleString("id-ID")}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Total rekomendasi yang belum masuk saldo
                </p>
              </div>
            </div>

            {/* PERSENTASE SALDO */}
            <div className="flex min-h-[155px] flex-col rounded-2xl border border-blue-200/70 bg-white p-5 shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-2xl">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Persentase Saldo
                </p>
              </div>

              <div className="mt-auto pt-5">
                <p className="text-3xl font-bold tracking-tight text-blue-600">
                  {loading
                    ? "—"
                    : `${persentaseSaldoGlobal.toLocaleString("id-ID", {
                        maximumFractionDigits: 2,
                      })}%`}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Persentase rekomendasi yang masuk saldo
                </p>
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
            {/* SALDO BPK */}
            <div className="relative flex h-full min-h-[390px] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50 p-6 shadow-xl transition duration-300 hover:shadow-2xl">
              {/* AKSEN DEKORATIF */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />

              {/* HEADER */}
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />

                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                      BPK Monitoring
                    </span>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-[#071426]">
                    Persentase Saldo
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Status saldo rekomendasi BPK.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-white/90 p-3 shadow-sm">
                  <span className="text-lg font-bold text-emerald-600">%</span>
                </div>
              </div>

              {/* LINGKARAN PERSENTASE */}
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-6">
                <div
                  className="relative flex h-48 w-48 items-center justify-center rounded-full p-[10px] shadow-lg shadow-emerald-900/10"
                  style={{
                    background: `conic-gradient(
          #16A34A 0% ${persentaseSaldo}%,
          #E2E8F0 ${persentaseSaldo}% 100%
        )`,
                  }}
                >
                  {/* LINGKARAN BAGIAN DALAM */}
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-emerald-100 bg-white shadow-inner">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Pencapaian Saldo
                    </span>

                    <p className="mt-1 text-4xl font-extrabold tracking-tight text-emerald-600">
                      {persentaseSaldo}%
                    </p>

                    <div className="mt-2 rounded-full bg-emerald-50 px-3 py-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Masuk Saldo
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Persentase rekomendasi BPK yang masuk saldo
                </p>
              </div>

              {/* RINGKASAN JUMLAH SALDO */}
              <div className="relative z-10 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                    <p className="text-xs font-semibold text-slate-500">
                      Masuk Saldo
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-extrabold text-emerald-600">
                    {bpkData.masukSaldo}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    Rekomendasi masuk saldo
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />

                    <p className="text-xs font-semibold text-slate-500">
                      Belum Saldo
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-extrabold text-slate-700">
                    {bpkData.belumSaldo}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    Rekomendasi belum masuk saldo
                  </p>
                </div>
              </div>
            </div>

            {/* KLASIFIKASI REKOMENDASI BPK */}
            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/95 p-6 shadow-xl transition duration-300 hover:shadow-2xl">
              {/* HEADER */}
              <div className="mb-7 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-[#D4A72C]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-800">
                      BPK Classification
                    </span>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-[#071426]">
                    Klasifikasi Rekomendasi
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Distribusi rekomendasi BPK berdasarkan kategori pemeriksaan.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total BPK
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-[#071426]">
                    {loading ? "—" : bpkData.total}
                  </p>
                </div>
              </div>

              {/* LAPORAN KEUANGAN */}
              <div className="mb-7">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#071426]" />
                    Laporan Keuangan
                  </span>

                  <div className="text-right">
                    <span className="text-sm font-bold text-[#071426]">
                      {loading ? "—" : bpkData.keuangan}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      (
                      {loading
                        ? "—"
                        : safePercentage(bpkData.keuangan, bpkData.total)}
                      %)
                    </span>
                  </div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100 p-[2px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#071426] to-slate-500 transition-all duration-700"
                    style={{
                      width: `${
                        loading
                          ? 0
                          : safePercentage(bpkData.keuangan, bpkData.total)
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* BUKAN KEUANGAN */}
              <div className="mb-7">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D4A72C]" />
                    Bukan Keuangan
                  </span>

                  <div className="text-right">
                    <span className="text-sm font-bold text-[#071426]">
                      {loading ? "—" : bpkData.bukanKeuangan}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      (
                      {loading
                        ? "—"
                        : safePercentage(bpkData.bukanKeuangan, bpkData.total)}
                      %)
                    </span>
                  </div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100 p-[2px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#B88912] to-[#F0C85A] transition-all duration-700"
                    style={{
                      width: `${
                        loading
                          ? 0
                          : safePercentage(bpkData.bukanKeuangan, bpkData.total)
                      }%`,
                    }}
                  />
                </div>
              </div>
              {/* STATUS TINDAK LANJUT BPK */}
              <div className="mb-6 border-t border-slate-100 pt-5">
                <h4 className="mb-4 text-sm font-bold text-[#071426]">
                  Status Tindak Lanjut BPK
                </h4>

                <div className="space-y-5">
                  {[
                    {
                      label: "Belum TL",
                      count: bpkData.belumTl,
                      percent: persentaseBpkBelumTl,
                      color: "bg-rose-500",
                      text: "text-rose-700",
                    },
                    {
                      label: "Sudah TL",
                      count: bpkData.sudahTl,
                      percent: persentaseBpkSudahTl,
                      color: "bg-amber-500",
                      text: "text-amber-700",
                    },
                    {
                      label: "Sudah Tuntas",
                      count: bpkData.sudahTuntas,
                      percent: persentaseBpkSudahTuntas,
                      color: "bg-emerald-500",
                      text: "text-emerald-700",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-600">
                          {item.label}
                        </span>

                        <span className={`text-sm font-bold ${item.text}`}>
                          {loading ? "—" : item.count}{" "}
                          <span className="text-xs">
                            ({loading ? "—" : `${item.percent}%`})
                          </span>
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-700`}
                          style={{
                            width: `${loading ? 0 : item.percent}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[10px] text-slate-400">
                  Persentase dihitung dari seluruh rekomendasi BPK.
                </p>
              </div>
              {/* RINGKASAN STATISTIK */}
              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total BPK
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#071426]">
                    {loading ? "—" : bpkData.total}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Keuangan
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#071426]">
                    {loading ? "—" : bpkData.keuangan}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Non Keuangan
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#071426]">
                    {loading ? "—" : bpkData.bukanKeuangan}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ITJEN */}
        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F0C85A]">
              Itjen Monitoring
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Monitoring Saldo dan Tindak Lanjut Itjen
            </h2>

            <p className="mt-1 text-sm text-white/70">
              Ringkasan saldo dan status penyelesaian rekomendasi Itjen periode{" "}
              {selectedYear}.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            {/* KARTU PERSENTASE SALDO ITJEN */}
            <div className="relative flex min-h-[390px] flex-col overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-white via-white to-sky-50 p-6 shadow-xl transition duration-300 hover:shadow-2xl">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl" />

              {/* HEADER */}
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />

                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-700">
                      Itjen Monitoring
                    </span>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-[#071426]">
                    Persentase Saldo
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Status saldo seluruh rekomendasi Itjen.
                  </p>
                </div>

                <div className="rounded-xl border border-sky-100 bg-white/90 p-3 shadow-sm">
                  <span className="text-lg font-bold text-sky-600">%</span>
                </div>
              </div>

              {/* LINGKARAN PERSENTASE */}
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-6">
                <div
                  className="relative flex h-48 w-48 items-center justify-center rounded-full p-[10px] shadow-lg shadow-sky-900/10"
                  style={{
                    background: `conic-gradient(
                      #0284C7 0% ${persentaseSaldoItjen}%,
                      #E2E8F0 ${persentaseSaldoItjen}% 100%
                    )`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-sky-100 bg-white shadow-inner">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Pencapaian Saldo
                    </span>

                    <p className="mt-1 text-4xl font-extrabold tracking-tight text-sky-600">
                      {loading ? "—" : `${persentaseSaldoItjen}%`}
                    </p>

                    <div className="mt-2 rounded-full bg-sky-50 px-3 py-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        Masuk Saldo
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-slate-500">
                  Persentase rekomendasi Itjen yang masuk saldo
                </p>
              </div>

              {/* JUMLAH SALDO ITJEN */}
              <div className="relative z-10 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-sky-100 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />

                    <p className="text-xs font-semibold text-slate-500">
                      Masuk Saldo
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-extrabold text-sky-600">
                    {loading
                      ? "—"
                      : itjenSaldoData.masukSaldo.toLocaleString("id-ID")}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    Rekomendasi masuk saldo
                  </p>
                </div>

                <div className="rounded-xl border border-orange-100 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />

                    <p className="text-xs font-semibold text-slate-500">
                      Belum Saldo
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-extrabold text-orange-600">
                    {loading
                      ? "—"
                      : itjenSaldoData.belumSaldo.toLocaleString("id-ID")}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    Belum masuk saldo
                  </p>
                </div>
              </div>
            </div>

            {/* KARTU STATUS TINDAK LANJUT ITJEN */}
            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/95 p-6 shadow-xl transition duration-300 hover:shadow-2xl">
              {/* HEADER */}
              <div className="mb-7 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />

                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                      ITJEN MONITORING
                    </span>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-[#071426]">
                    Status Tindak Lanjut ITJEN
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Distribusi status penyelesaian seluruh rekomendasi ITJEN.
                  </p>
                </div>

                <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total ITJEN
                  </p>

                  <p className="mt-1 text-2xl font-extrabold text-[#071426]">
                    {loading ? "—" : itjenData.total}
                  </p>
                </div>
              </div>

              {/* STATUS TINDAK LANJUT */}
              <div className="space-y-6">
                {[
                  {
                    label: "Belum TL",
                    count: itjenData.belumTl,
                    percent: persentaseBelumTl,
                    color: "bg-rose-500",
                    text: "text-rose-700",
                  },
                  {
                    label: "Sudah TL",
                    count: itjenData.sudahTl,
                    percent: persentaseSudahTl,
                    color: "bg-amber-500",
                    text: "text-amber-700",
                  },
                  {
                    label: "Sudah Tuntas",
                    count: itjenData.sudahTuntas,
                    percent: persentaseTuntas,
                    color: "bg-emerald-500",
                    text: "text-emerald-700",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${item.color}`}
                        />
                        {item.label}
                      </span>

                      <span className={`text-sm font-bold ${item.text}`}>
                        {loading ? "—" : item.count}{" "}
                        <span className="text-xs">
                          ({loading ? "—" : `${item.percent}%`})
                        </span>
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 p-[2px]">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-700`}
                        style={{
                          width: `${loading ? 0 : item.percent}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-5 border-t border-slate-100 pt-4 text-[10px] text-slate-400">
                Persentase dihitung dari seluruh rekomendasi ITJEN.
              </p>
              {/* RINGKASAN STATISTIK ITJEN */}
              <div className="mt-7 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total ITJEN
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#071426]">
                    {loading ? "—" : itjenData.total}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Laporan Keuangan
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#071426]">
                    {loading ? "—" : itjenData.laporanKeuangan}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Bukan Keuangan
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#071426]">
                    {loading ? "—" : itjenData.bukanKeuangan}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tindak Lanjut Pemeriksaan
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#071426]">
                    {loading ? "—" : itjenData.tindakPemeriksaan}
                  </p>
                </div>
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
                href={`/rekomendasi?year=${selectedYear}`}
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
                          {item.saldo_status === "MASUK_SALDO"
                            ? "Masuk Saldo"
                            : item.saldo_status === "BELUM_SALDO"
                            ? "Belum Saldo"
                            : "-"}
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
        {/* MODAL DAFTAR REKOMENDASI BERDASARKAN STATUS SALDO */}
        {saldoFilter && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 sm:p-4"
            onClick={() => {
              setSaldoFilter(null);
              setSelectedSaldoRecommendation(null);
            }}
          >
            <div
              className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#D4A72C]">
                    {selectedSaldoRecommendation
                      ? `Detail Rekomendasi • Periode ${selectedYear}`
                      : `Status Saldo • Periode ${selectedYear}`}
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#071426]">
                    {selectedSaldoRecommendation
                      ? "Detail Rekomendasi"
                      : saldoFilter === "MASUK_SALDO"
                      ? "Daftar Rekomendasi Masuk Saldo"
                      : "Daftar Rekomendasi Belum Masuk Saldo"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSaldoRecommendation
                      ? `${selectedSaldoRecommendation.source} • ID Data ${selectedSaldoRecommendation.id}`
                      : `Total ${saldoRecommendations.length} rekomendasi ditemukan.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSaldoFilter(null);
                    setSelectedSaldoRecommendation(null);
                  }}
                  className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100"
                  aria-label="Tutup daftar saldo"
                >
                  ×
                </button>
              </div>

              {selectedSaldoRecommendation ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {/* HEADER DETAIL */}
                  <div className="border-b border-slate-200 bg-gradient-to-r from-[#071426] to-[#17365D] p-6 text-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F0C85A]">
                          Detail Rekomendasi
                        </p>

                        <h3 className="mt-2 text-2xl font-bold">
                          {selectedSaldoRecommendation.lha_number ||
                            "Tanpa Nomor LHA"}
                        </h3>

                        <p className="mt-2 text-sm text-white/70">
                          {selectedSaldoRecommendation.source} •{" "}
                          {selectedSaldoRecommendation.category} • ID{" "}
                          {selectedSaldoRecommendation.id}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedSaldoRecommendation(null)}
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                      >
                        ← Kembali
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6 p-5 sm:p-6">
                    {/* INFORMASI LHA / LHP */}
                    <section>
                      <h4 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-[#071426]">
                        Informasi LHA / LHP
                      </h4>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                          {
                            label: "ID Data",
                            value: String(selectedSaldoRecommendation.id),
                          },
                          {
                            label: "Sumber Pemeriksaan",
                            value: selectedSaldoRecommendation.source,
                          },
                          {
                            label: "Kategori",
                            value: selectedSaldoRecommendation.category,
                          },
                          {
                            label: "Nomor LHA / LHP",
                            value: selectedSaldoRecommendation.lha_number,
                          },
                          {
                            label: "Tanggal LHA / LHP",
                            value: formatDate(
                              selectedSaldoRecommendation.lha_date
                            ),
                          },
                          {
                            label: "Nomor Rekomendasi",
                            value:
                              selectedSaldoRecommendation.recommendation_number ==
                              null
                                ? "-"
                                : String(
                                    selectedSaldoRecommendation.recommendation_number
                                  ),
                          },
                        ].map((field) => (
                          <div
                            key={field.label}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="text-xs font-medium text-slate-500">
                              {field.label}
                            </p>

                            <p className="mt-2 break-words text-sm font-semibold text-[#071426]">
                              {field.value || "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* STATUS REKOMENDASI */}
                    <section>
                      <h4 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-[#071426]">
                        Status Rekomendasi
                      </h4>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs text-slate-500">Status Saldo</p>

                          <span
                            className={`mt-2 inline-flex rounded-lg border px-3 py-1.5 text-xs font-bold ${getSaldoStatusStyle(
                              selectedSaldoRecommendation.saldo_status
                            )}`}
                          >
                            {selectedSaldoRecommendation.saldo_status ===
                            "MASUK_SALDO"
                              ? "Masuk Saldo"
                              : selectedSaldoRecommendation.saldo_status ===
                                "BELUM_SALDO"
                              ? "Belum Masuk Saldo"
                              : selectedSaldoRecommendation.saldo_status || "-"}
                          </span>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs text-slate-500">
                            Status Tindak Lanjut
                          </p>

                          <p className="mt-2 text-sm font-bold text-[#071426]">
                            {getStatusLabel(
                              selectedSaldoRecommendation.follow_up_status
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs text-slate-500">
                            Capaian Rekomendasi
                          </p>

                          <p className="mt-2 text-2xl font-extrabold text-blue-700">
                            {safeNumber(selectedSaldoRecommendation.capaian)}%
                          </p>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    safeNumber(
                                      selectedSaldoRecommendation.capaian
                                    )
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* DATA TEMUAN DAN REKOMENDASI */}
                    <section>
                      <h4 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-[#071426]">
                        Data Temuan dan Rekomendasi
                      </h4>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[
                          {
                            label: "No Temuan",
                            value: selectedSaldoRecommendation.no_temuan,
                          },
                          {
                            label: "Judul",
                            value: selectedSaldoRecommendation.judul,
                          },
                          {
                            label: "Temuan",
                            value: selectedSaldoRecommendation.temuan,
                          },
                          {
                            label: "Rekomendasi Pemeriksaan",
                            value: selectedSaldoRecommendation.recommendation,
                          },
                          {
                            label: "Uraian / Keterangan",
                            value: selectedSaldoRecommendation.description,
                          },
                          {
                            label: "Keterangan 1",
                            value: selectedSaldoRecommendation.keterangan_1,
                          },
                          {
                            label: "Keterangan 2",
                            value: selectedSaldoRecommendation.keterangan_2,
                          },
                          {
                            label: "Keterangan 3",
                            value: selectedSaldoRecommendation.keterangan_3,
                          },
                        ].map((field) => (
                          <div
                            key={field.label}
                            className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 ${
                              [
                                "Temuan",
                                "Rekomendasi Pemeriksaan",
                                "Uraian / Keterangan",
                                "Keterangan 1",
                                "Keterangan 2",
                                "Keterangan 3",
                              ].includes(field.label)
                                ? "sm:col-span-2"
                                : ""
                            }`}
                          >
                            <p className="mb-2 text-xs font-bold text-slate-500">
                              {field.label}
                            </p>

                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                              {field.value?.trim() || "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* RENCANA AKSI DAN TINDAK LANJUT */}
                    <section>
                      <h4 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-[#071426]">
                        Rencana Aksi dan Tindak Lanjut
                      </h4>

                      <div className="space-y-4">
                        {[
                          {
                            label: "Rencana Aksi",
                            value: selectedSaldoRecommendation.rencana_aksi,
                          },
                          {
                            label: "Keterangan / Bukti Dukung",
                            value:
                              selectedSaldoRecommendation.keterangan_bukti_dukung,
                          },
                          {
                            label: "Tindak Lanjut",
                            value: selectedSaldoRecommendation.tindak_lanjut,
                          },
                        ].map((field) => (
                          <div
                            key={field.label}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <p className="mb-2 text-xs font-bold text-slate-500">
                              {field.label}
                            </p>

                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                              {field.value?.trim() || "-"}
                            </p>
                          </div>
                        ))}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 p-4">
                            <p className="text-xs font-bold text-slate-500">
                              Waktu Pelaksanaan
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-700">
                              {selectedSaldoRecommendation.waktu_pelaksanaan
                                ? formatDate(
                                    selectedSaldoRecommendation.waktu_pelaksanaan
                                  )
                                : "-"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4">
                            <p className="text-xs font-bold text-slate-500">
                              UIC / Penanggung Jawab
                            </p>

                            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold text-slate-700">
                              {selectedSaldoRecommendation.uic?.trim() || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* TOMBOL AKSI */}
                    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSaldoRecommendation({
                            ...selectedSaldoRecommendation,
                          });
                          setSelectedSaldoRecommendation(null);
                          setSaldoFilter(null);
                        }}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                      >
                        Edit Data
                      </button>

                      <button
                        type="button"
                        disabled={
                          deletingSaldoId === selectedSaldoRecommendation.id
                        }
                        onClick={() =>
                          void deleteSaldoRecommendation(
                            selectedSaldoRecommendation
                          )
                        }
                        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingSaldoId === selectedSaldoRecommendation.id
                          ? "Menghapus..."
                          : "Hapus Data"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : loading ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Memuat data rekomendasi...
                </div>
              ) : saldoRecommendations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
                  <p className="font-semibold text-slate-700">
                    Belum ada rekomendasi untuk status ini.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Coba periksa status saldo atau tahun periode yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "No",
                          "Sumber",
                          "Nomor LHA / LHP",
                          "Tanggal",
                          "Kategori",
                          "Status Saldo",
                          "Aksi",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {saldoRecommendations.map((item, index) => (
                        <tr
                          key={item.id}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {index + 1}
                          </td>

                          <td className="px-4 py-3 text-sm font-semibold text-[#071426]">
                            {item.source || "-"}
                          </td>

                          <td className="px-4 py-3 text-sm font-semibold text-[#071426]">
                            {item.lha_number || "-"}
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatDate(item.lha_date)}
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-600">
                            {item.category || "-"}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${getSaldoStatusStyle(
                                item.saldo_status
                              )}`}
                            >
                              {item.saldo_status === "MASUK_SALDO"
                                ? "Masuk Saldo"
                                : item.saldo_status === "BELUM_SALDO"
                                ? "Belum Saldo"
                                : item.saldo_status || "-"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSaldoRecommendation(item)
                                }
                                className="rounded-lg bg-[#071426] px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                              >
                                Detail
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSaldoRecommendation({ ...item });
                                  setSelectedSaldoRecommendation(null);
                                  setSaldoFilter(null);
                                }}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={deletingSaldoId === item.id}
                                onClick={() =>
                                  void deleteSaldoRecommendation(item)
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingSaldoId === item.id
                                  ? "Menghapus..."
                                  : "Hapus"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* MODAL EDIT REKOMENDASI */}
        {editingSaldoRecommendation && (
          <div
            className="fixed inset-0 z-[10000] grid h-dvh w-screen place-items-center overflow-y-auto bg-slate-950/70 p-4"
            onClick={() => {
              if (!savingSaldoEdit) setEditingSaldoRecommendation(null);
            }}
          >
            <div
              className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Edit Rekomendasi
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#071426]">
                    Ubah Data Rekomendasi
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    ID {editingSaldoRecommendation.id} · LHA{" "}
                    {editingSaldoRecommendation.lha_number}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={savingSaldoEdit}
                  onClick={() => setEditingSaldoRecommendation(null)}
                  className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Sumber
                  </label>
                  <select
                    value={editingSaldoRecommendation.source}
                    onChange={(e) => updateSaldoEdit("source", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                  >
                    <option value="BPK">BPK</option>
                    <option value="ITJEN">ITJEN</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Kategori
                  </label>
                  <input
                    value={editingSaldoRecommendation.category}
                    onChange={(e) =>
                      updateSaldoEdit("category", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Nomor LHA / LHP
                  </label>
                  <input
                    value={editingSaldoRecommendation.lha_number}
                    onChange={(e) =>
                      updateSaldoEdit("lha_number", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Tanggal LHA / LHP
                  </label>
                  <input
                    type="date"
                    value={
                      editingSaldoRecommendation.lha_date?.slice(0, 10) ?? ""
                    }
                    onChange={(e) =>
                      updateSaldoEdit("lha_date", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Nomor Rekomendasi
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={
                      editingSaldoRecommendation.recommendation_number ?? ""
                    }
                    onChange={(e) =>
                      updateSaldoEdit(
                        "recommendation_number",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Status Tindak Lanjut
                  </label>
                  <select
                    value={editingSaldoRecommendation.follow_up_status}
                    onChange={(e) =>
                      updateSaldoEdit("follow_up_status", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                  >
                    <option value="BELUM_TL">Belum TL</option>
                    <option value="SUDAH_TL">Sudah TL</option>
                    <option value="SUDAH_TUNTAS">Sudah Tuntas</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Status Saldo
                  </label>
                  <select
                    value={editingSaldoRecommendation.saldo_status}
                    onChange={(e) =>
                      updateSaldoEdit("saldo_status", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                  >
                    <option value="MASUK_SALDO">Masuk Saldo</option>
                    <option value="BELUM_SALDO">Belum Masuk Saldo</option>
                    <option value="TIDAK_RELEVAN">Tidak Relevan</option>
                  </select>
                </div>

                {(
                  [
                    ["temuan", "Temuan"],
                    ["recommendation", "Rekomendasi"],
                    ["description", "Uraian / Keterangan"],
                    ["keterangan_1", "Keterangan 1"],
                    ["keterangan_2", "Keterangan 2"],
                    ["keterangan_3", "Keterangan 3"],
                    ["no_temuan", "Nomor Temuan"],
                    ["judul", "Judul"],
                    ["rencana_aksi", "Rencana Aksi"],
                    ["keterangan_bukti_dukung", "Bukti Dukung"],
                    ["waktu_pelaksanaan", "Waktu Pelaksanaan"],
                    ["uic", "UIC / Penanggung Jawab"],
                    ["tindak_lanjut", "Tindak Lanjut"],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      {label}
                    </label>
                    <textarea
                      rows={2}
                      value={editingSaldoRecommendation[field] ?? ""}
                      onChange={(e) => updateSaldoEdit(field, e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={savingSaldoEdit}
                  onClick={() => setEditingSaldoRecommendation(null)}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={savingSaldoEdit}
                  onClick={() => void saveSaldoEdit()}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSaldoEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL PENGATURAN RUMUS INDEKS CAPAIAN */}
        {showIndeksRumusModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#071426]">
                    Pengaturan Rumus Indeks Capaian
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ubah rumus untuk menghitung Indeks Capaian Tindak Lanjut.
                    Pengaturan ini terpisah dari rumus Persentase Saldo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowIndeksRumusModal(false)}
                  disabled={savingRumus}
                  className="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  aria-label="Tutup"
                >
                  ×
                </button>
              </div>

              <label
                htmlFor="rumus-indeks-capaian"
                className="mb-2 block text-sm font-semibold text-[#071426]"
              >
                Rumus Indeks Capaian
              </label>

              <textarea
                id="rumus-indeks-capaian"
                value={rumusIndeks}
                onChange={(event) => setRumusIndeks(event.target.value)}
                rows={4}
                spellCheck={false}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm text-[#071426] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                placeholder="Contoh: min(capaian / 0.62, 1.2)"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Variabel yang tersedia meliputi capaian, saldo, tl_belum_tuntas,
                dan tl_sudah_tuntas. Nilai indeks ditampilkan dalam persentase.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIndeksRumusModal(false)}
                  disabled={savingRumus}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => saveRumus("INDEKS")}
                  disabled={savingRumus}
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {savingRumus ? "Menyimpan..." : "Simpan Rumus"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL PENGATURAN RUMUS PERSENTASE SALDO */}
        {showSaldoRumusModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#071426]">
                    Pengaturan Rumus Persentase Saldo
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Rumus ini berlaku khusus untuk Persentase Saldo. Pengubahan
                    tidak mengubah Capaian maupun Indeks Capaian.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSaldoRumusModal(false)}
                  disabled={savingRumus}
                  className="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  aria-label="Tutup"
                >
                  ×
                </button>
              </div>

              <label
                htmlFor="rumus-persentase-saldo"
                className="mb-2 block text-sm font-semibold text-[#071426]"
              >
                Rumus Persentase Saldo
              </label>

              <textarea
                id="rumus-persentase-saldo"
                value={rumusPersentaseSaldo}
                onChange={(event) =>
                  setRumusPersentaseSaldo(event.target.value)
                }
                rows={4}
                spellCheck={false}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm text-[#071426] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Masukkan rumus Persentase Saldo"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Variabel: saldo, tl_belum_tuntas, tl_sudah_tuntas, dan capaian.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSaldoRumusModal(false)}
                  disabled={savingRumus}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => saveRumus("SALDO")}
                  disabled={savingRumus}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingRumus ? "Menyimpan..." : "Simpan Rumus"}
                </button>
              </div>
            </div>
          </div>
        )}
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
