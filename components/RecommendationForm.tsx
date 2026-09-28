"use client";

import { useEffect, useState } from "react";

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

type Props = {
  onSaved: () => void;
  editingData?: Recommendation | null;
  onCancelEdit?: () => void;
};

export default function RecommendationForm({
  onSaved,
  editingData,
  onCancelEdit,
}: Props) {
  const isEditing = Boolean(editingData);

  const [source, setSource] = useState("BPK");
  const [category, setCategory] = useState("");
  const [lhaNumber, setLhaNumber] = useState("");
  const [lhaDate, setLhaDate] = useState("");
  const [recommendationCount, setRecommendationCount] = useState("1");

  const [followUpStatus, setFollowUpStatus] = useState("BELUM_TL");
  const [saldoStatus, setSaldoStatus] = useState("BELUM_SALDO");

  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!editingData) {
      setSource("BPK");
      setCategory("");
      setLhaNumber("");
      setLhaDate("");
      setRecommendationCount("1");
      setFollowUpStatus("BELUM_TL");
      setSaldoStatus("BELUM_SALDO");
      setDescription("");
      setMessage("");
      return;
    }

    setSource(editingData.source || "BPK");
    setCategory(editingData.category || "");
    setLhaNumber(editingData.lha_number || "");

    setLhaDate(
      editingData.lha_date ? editingData.lha_date.substring(0, 10) : ""
    );

    setRecommendationCount(String(editingData.recommendation_count || 1));

    setFollowUpStatus(
      editingData.follow_up_status === "BELUM_TUNTAS"
        ? "SUDAH_TL"
        : editingData.follow_up_status || "BELUM_TL"
    );

    setSaldoStatus(editingData.saldo_status || "BELUM_SALDO");

    setDescription(editingData.description || "");
    setMessage("");
  }, [editingData]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!category) {
      setMessage("Kategori wajib dipilih.");
      return;
    }

    if (!lhaNumber.trim()) {
      setMessage("Nomor LHA / LHP wajib diisi.");
      return;
    }

    if (!lhaDate) {
      setMessage("Tanggal wajib diisi.");
      return;
    }

    if (Number(recommendationCount) < 1) {
      setMessage("Jumlah rekomendasi minimal 1.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/recommendations", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isEditing
            ? {
                id: editingData?.id,
              }
            : {}),

          source,
          category,
          lhaNumber: lhaNumber.trim(),
          lhaDate,
          recommendationCount: Number(recommendationCount),
          followUpStatus,
          saldoStatus,
          description: description.trim(),
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.message || "Gagal menyimpan rekomendasi.");
      }

      setMessage(
        isEditing
          ? "Rekomendasi berhasil diperbarui."
          : "Rekomendasi berhasil ditambahkan."
      );

      if (!isEditing) {
        setSource("BPK");
        setCategory("");
        setLhaNumber("");
        setLhaDate("");
        setRecommendationCount("1");
        setFollowUpStatus("BELUM_TL");
        setSaldoStatus("BELUM_SALDO");
        setDescription("");
      }

      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan data."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#D4A72C] focus:ring-2 focus:ring-[#D4A72C]/20";

  const selectClass =
    "w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#D4A72C] focus:ring-2 focus:ring-[#D4A72C]/20";

  const labelClass = "mb-2 block text-sm font-bold text-slate-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* FORM HEADER */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1F3A] text-white">
            <span className="text-lg">📋</span>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? "Edit Rekomendasi" : "Tambah Rekomendasi"}
            </h3>

            <p className="text-xs font-medium text-slate-500">
              Lengkapi data rekomendasi pemeriksaan dengan benar.
            </p>
          </div>
        </div>
      </div>

      {/* FORM */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* SOURCE */}
        <div>
          <label className={labelClass}>Sumber</label>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={selectClass}
          >
            <option value="BPK">BPK</option>
            <option value="ITJEN">Itjen</option>
          </select>
        </div>

        {/* CATEGORY */}
        <div>
          <label className={labelClass}>
            Kategori
            <span className="ml-1 text-red-500">*</span>
          </label>

          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={selectClass}
          >
            <option value="">Pilih kategori</option>

            <option value="Laporan Keuangan">Laporan Keuangan</option>

            <option value="Bukan Keuangan">Bukan Keuangan</option>

            <option value="Tindak Lanjut Pemeriksaan">
              Tindak Lanjut Pemeriksaan
            </option>
          </select>
        </div>

        {/* LHA */}
        <div>
          <label className={labelClass}>
            Nomor LHA / LHP
            <span className="ml-1 text-red-500">*</span>
          </label>

          <input
            required
            type="text"
            value={lhaNumber}
            onChange={(e) => setLhaNumber(e.target.value)}
            placeholder="Contoh: 52/LHP/XV/07/2025"
            className={inputClass}
          />
        </div>

        {/* DATE */}
        <div>
          <label className={labelClass}>
            Tanggal
            <span className="ml-1 text-red-500">*</span>
          </label>

          <input
            required
            type="date"
            value={lhaDate}
            onChange={(e) => setLhaDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* COUNT */}
        <div>
          <label className={labelClass}>
            Jumlah Rekomendasi
            <span className="ml-1 text-red-500">*</span>
          </label>

          <input
            required
            min="1"
            type="number"
            value={recommendationCount}
            onChange={(e) => setRecommendationCount(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* SALDO */}
        <div>
          <label className={labelClass}>Status Saldo</label>

          <select
            value={saldoStatus}
            onChange={(e) => setSaldoStatus(e.target.value)}
            className={selectClass}
          >
            <option value="MASUK_SALDO">Masuk Saldo</option>

            <option value="BELUM_SALDO">Belum Masuk Saldo</option>

            <option value="TIDAK_RELEVAN">Tidak Relevan</option>
          </select>
        </div>

        {/* FOLLOW UP */}
        <div className="md:col-span-2">
          <label className={labelClass}>Status Tindak Lanjut</label>

          <select
            value={followUpStatus}
            onChange={(e) => setFollowUpStatus(e.target.value)}
            className={selectClass}
          >
            <option value="BELUM_TL">Belum Tindak Lanjut</option>

            <option value="SUDAH_TL">Sudah Tindak Lanjut</option>

            <option value="SUDAH_TUNTAS">Sudah Tuntas</option>
          </select>
        </div>

        {/* DESCRIPTION */}
        <div className="md:col-span-2">
          <label className={labelClass}>Keterangan</label>

          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tambahkan keterangan jika diperlukan..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* MESSAGE */}
      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.toLowerCase().includes("berhasil")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* BUTTON */}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal Edit
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-[#0B1F3A] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#132d52] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Menyimpan..."
            : isEditing
            ? "Simpan Perubahan"
            : "Tambah Rekomendasi"}
        </button>
      </div>
    </form>
  );
}
