"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type RecommendationItem = {
  temuan: string;
  recommendation: string;
  followUpStatus: string;
  saldoStatus: string;
  keterangan_1: string;
  keterangan_2: string;
  keterangan_3: string;
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
  temuan?: string | null;
  recommendation?: string | null;
  description?: string | null;
  keterangan_1?: string | null;
  keterangan_2?: string | null;
  keterangan_3?: string | null;
};

type Props = {
  onSaved: () => void;
  editingData?: Recommendation | null;
  onCancelEdit?: () => void;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
};

const emptyItem = (): RecommendationItem => ({
  temuan: "",
  recommendation: "",
  followUpStatus: "BELUM_TL",
  saldoStatus: "BELUM_SALDO",
  keterangan_1: "",
  keterangan_2: "",
  keterangan_3: "",
});

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#D4A72C] focus:ring-2 focus:ring-[#D4A72C]/20 disabled:bg-slate-100 disabled:text-slate-500";

const selectClass =
  "w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#D4A72C] focus:ring-2 focus:ring-[#D4A72C]/20 disabled:bg-slate-100 disabled:text-slate-500";

const labelClass = "mb-2 block text-sm font-bold text-slate-800";

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
  const [items, setItems] = useState<RecommendationItem[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!editingData) {
      setSource("BPK");
      setCategory("");
      setLhaNumber("");
      setLhaDate("");
      setItems([emptyItem()]);
      setMessage("");
      return;
    }

    setSource(editingData.source || "BPK");
    setCategory(editingData.category || "");
    setLhaNumber(editingData.lha_number || "");
    setLhaDate(editingData.lha_date?.substring(0, 10) || "");

    setItems([
      {
        temuan: editingData.temuan || "",
        recommendation: editingData.recommendation || "",
        followUpStatus: editingData.follow_up_status || "BELUM_TL",
        saldoStatus: editingData.saldo_status || "BELUM_SALDO",
        keterangan_1: editingData.keterangan_1 || "",
        keterangan_2: editingData.keterangan_2 || "",
        keterangan_3: editingData.keterangan_3 || "",
      },
    ]);

    setMessage("");
  }, [editingData]);

  function updateItem(
    index: number,
    field: keyof RecommendationItem,
    value: string
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.length <= 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function validateForm(): string | null {
    if (!category.trim()) {
      return "Kategori wajib dipilih.";
    }

    if (!lhaNumber.trim()) {
      return "Nomor LHA / LHP wajib diisi.";
    }

    if (!lhaDate) {
      return "Tanggal wajib diisi.";
    }

    if (items.length === 0) {
      return "Minimal harus ada satu rekomendasi.";
    }

    const hasIncompleteItem = items.some(
      (item) => !item.temuan.trim() || !item.recommendation.trim()
    );

    if (hasIncompleteItem) {
      return "Temuan dan rekomendasi wajib diisi untuk setiap baris.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (isEditing && !editingData) {
      setMessage("Data yang akan diedit tidak ditemukan.");
      return;
    }

    setLoading(true);

    const commonData = {
      source,
      category,
      lhaNumber: lhaNumber.trim(),
      lhaDate,
    };

    const body = isEditing
      ? {
          id: editingData!.id,
          ...commonData,
          temuan: items[0].temuan.trim(),
          recommendation: items[0].recommendation.trim(),
          followUpStatus: items[0].followUpStatus,
          saldoStatus: items[0].saldoStatus,
          keterangan_1: items[0].keterangan_1.trim(),
          keterangan_2: items[0].keterangan_2.trim(),
          keterangan_3: items[0].keterangan_3.trim(),
        }
      : {
          ...commonData,
          recommendations: items.map((item) => ({
            temuan: item.temuan.trim(),
            recommendation: item.recommendation.trim(),
            followUpStatus: item.followUpStatus,
            saldoStatus: item.saldoStatus,
            keterangan_1: item.keterangan_1.trim(),
            keterangan_2: item.keterangan_2.trim(),
            keterangan_3: item.keterangan_3.trim(),
          })),
        };

    try {
      const response = await fetch("/api/recommendations", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      let result: ApiResponse;

      try {
        result = (await response.json()) as ApiResponse;
      } catch {
        throw new Error("Respons dari server tidak dapat dibaca.");
      }

      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message ||
            `Gagal ${isEditing ? "memperbarui" : "menambahkan"} rekomendasi.`
        );
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
        setItems([emptyItem()]);
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

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      {/* HEADER */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-[#0B1F3A] via-[#102B50] to-[#0B1F3A] px-6 py-5 text-white md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-[#D4A72C]/40 bg-[#D4A72C]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#F0C84B]">
              Monitoring APF
            </div>

            <h2 className="text-xl font-bold md:text-2xl">
              {isEditing ? "Edit Rekomendasi" : "Tambah Rekomendasi"}
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300 md:text-sm">
              Isi data LHA / LHP terlebih dahulu, kemudian masukkan satu atau
              beberapa rekomendasi.
            </p>
          </div>

          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-xl md:flex">
            📋
          </div>
        </div>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit}>
        <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-5 md:p-8">
          {/* DATA LHA */}
          <section>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B1F3A] text-sm font-bold text-white">
                1
              </div>

              <div>
                <h3 className="font-bold text-slate-900">Data LHA / LHP</h3>

                <p className="text-xs text-slate-500">
                  Informasi umum dokumen pemeriksaan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* SUMBER */}
              <div>
                <label htmlFor="source" className={labelClass}>
                  Sumber
                </label>

                <select
                  id="source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  className={selectClass}
                  disabled={loading}
                >
                  <option value="BPK">BPK</option>
                  <option value="ITJEN">ITJEN</option>
                </select>
              </div>

              {/* KATEGORI */}
              <div>
                <label htmlFor="category" className={labelClass}>
                  Kategori <span className="text-red-500">*</span>
                </label>

                <select
                  id="category"
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={selectClass}
                  disabled={loading}
                >
                  <option value="">Pilih kategori</option>
                  <option value="KEUANGAN">Keuangan</option>
                  <option value="BUKAN_KEUANGAN">Bukan Keuangan</option>
                  <option value="TINDAK_LANJUT">
                    Tindak Lanjut Pemeriksaan
                  </option>
                </select>
              </div>

              {/* NOMOR */}
              <div>
                <label htmlFor="lhaNumber" className={labelClass}>
                  Nomor LHA / LHP <span className="text-red-500">*</span>
                </label>

                <input
                  id="lhaNumber"
                  required
                  type="text"
                  value={lhaNumber}
                  onChange={(event) => setLhaNumber(event.target.value)}
                  placeholder="Contoh: 52/LHP/XV/07/2025"
                  className={inputClass}
                  disabled={loading}
                />
              </div>

              {/* TANGGAL */}
              <div>
                <label htmlFor="lhaDate" className={labelClass}>
                  Tanggal <span className="text-red-500">*</span>
                </label>

                <input
                  id="lhaDate"
                  required
                  type="date"
                  value={lhaDate}
                  onChange={(event) => setLhaDate(event.target.value)}
                  className={inputClass}
                  disabled={loading}
                />
              </div>
            </div>
          </section>

          {/* PEMBATAS */}
          <div className="my-8 border-t border-slate-200" />

          {/* DAFTAR REKOMENDASI */}
          <section>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B1F3A] text-sm font-bold text-white">
                  2
                </div>

                <div>
                  <h3 className="font-bold text-slate-900">
                    Daftar Rekomendasi
                  </h3>

                  <p className="text-xs text-slate-500">
                    Setiap baris disimpan sebagai satu rekomendasi.
                  </p>
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={addItem}
                  disabled={loading}
                  className="rounded-xl border-2 border-[#0B1F3A] bg-white px-4 py-2.5 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#0B1F3A] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Tambah Baris
                </button>
              )}
            </div>

            <div className="space-y-5">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70"
                >
                  {/* JUDUL REKOMENDASI */}
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1F3A] text-sm font-black text-white">
                        {index + 1}
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900">
                          Rekomendasi {index + 1}
                        </h4>

                        <p className="text-[11px] text-slate-500">
                          Detail temuan dan tindak lanjut
                        </p>
                      </div>
                    </div>

                    {!isEditing && items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={loading}
                        className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    )}
                  </div>

                  <div className="space-y-5 p-5">
                    {/* TEMUAN */}
                    <div>
                      <label htmlFor={`temuan-${index}`} className={labelClass}>
                        Temuan <span className="text-red-500">*</span>
                      </label>

                      <textarea
                        id={`temuan-${index}`}
                        required
                        rows={4}
                        value={item.temuan}
                        onChange={(event) =>
                          updateItem(index, "temuan", event.target.value)
                        }
                        placeholder="Tuliskan temuan pemeriksaan..."
                        className={`${inputClass} resize-y`}
                        disabled={loading}
                      />
                    </div>

                    {/* REKOMENDASI */}
                    <div>
                      <label
                        htmlFor={`recommendation-${index}`}
                        className={labelClass}
                      >
                        Rekomendasi <span className="text-red-500">*</span>
                      </label>

                      <textarea
                        id={`recommendation-${index}`}
                        required
                        rows={4}
                        value={item.recommendation}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "recommendation",
                            event.target.value
                          )
                        }
                        placeholder="Tuliskan rekomendasi untuk temuan ini..."
                        className={`${inputClass} resize-y`}
                        disabled={loading}
                      />
                    </div>

                    {/* STATUS */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`followUpStatus-${index}`}
                          className={labelClass}
                        >
                          Status Tindak Lanjut
                        </label>

                        <select
                          id={`followUpStatus-${index}`}
                          value={item.followUpStatus}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "followUpStatus",
                              event.target.value
                            )
                          }
                          className={selectClass}
                          disabled={loading}
                        >
                          <option value="BELUM_TL">Belum Tindak Lanjut</option>

                          <option value="SUDAH_TL">Sudah Tindak Lanjut</option>

                          <option value="SUDAH_TUNTAS">Sudah Tuntas</option>

                          <option value="BELUM_TUNTAS">Belum Tuntas</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`saldoStatus-${index}`}
                          className={labelClass}
                        >
                          Status Saldo
                        </label>

                        <select
                          id={`saldoStatus-${index}`}
                          value={item.saldoStatus}
                          onChange={(event) =>
                            updateItem(index, "saldoStatus", event.target.value)
                          }
                          className={selectClass}
                          disabled={loading}
                        >
                          <option value="MASUK_SALDO">Masuk Saldo</option>

                          <option value="BELUM_SALDO">Belum Saldo</option>

                          <option value="TIDAK_RELEVAN">Tidak Relevan</option>
                        </select>
                      </div>
                    </div>

                    {/* KETERANGAN */}
                    <div>
                      <div className="mb-4">
                        <h4 className="text-sm font-bold text-slate-800">
                          Keterangan
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          Keterangan dibagi menjadi tiga bagian agar informasi
                          lebih mudah dibaca dan tidak terlalu panjang dalam
                          satu kolom.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        {/* KETERANGAN 1 */}
                        <div>
                          <label
                            htmlFor={`keterangan-1-${index}`}
                            className={labelClass}
                          >
                            Keterangan 1
                          </label>

                          <textarea
                            id={`keterangan-1-${index}`}
                            rows={5}
                            value={item.keterangan_1}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "keterangan_1",
                                event.target.value
                              )
                            }
                            placeholder="Keterangan bagian pertama..."
                            className={`${inputClass} resize-y`}
                            disabled={loading}
                          />
                        </div>

                        {/* KETERANGAN 2 */}
                        <div>
                          <label
                            htmlFor={`keterangan-2-${index}`}
                            className={labelClass}
                          >
                            Keterangan 2
                          </label>

                          <textarea
                            id={`keterangan-2-${index}`}
                            rows={5}
                            value={item.keterangan_2}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "keterangan_2",
                                event.target.value
                              )
                            }
                            placeholder="Keterangan bagian kedua..."
                            className={`${inputClass} resize-y`}
                            disabled={loading}
                          />
                        </div>

                        {/* KETERANGAN 3 */}
                        <div>
                          <label
                            htmlFor={`keterangan-3-${index}`}
                            className={labelClass}
                          >
                            Keterangan 3
                          </label>

                          <textarea
                            id={`keterangan-3-${index}`}
                            rows={5}
                            value={item.keterangan_3}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "keterangan_3",
                                event.target.value
                              )
                            }
                            placeholder="Keterangan bagian ketiga..."
                            className={`${inputClass} resize-y`}
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PESAN */}
          {message && (
            <div
              role="status"
              aria-live="polite"
              className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${
                message.toLowerCase().includes("berhasil")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end md:px-8">
          {isEditing && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Batal
            </button>
          )}

          {!isEditing && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Batal
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#0B1F3A] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#132d52] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Menyimpan..."
              : isEditing
              ? "Simpan Perubahan"
              : "Simpan Rekomendasi"}
          </button>
        </div>
      </form>
    </div>
  );
}
