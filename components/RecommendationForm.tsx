"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type RecommendationItem = {
  noTemuan: string;
  judul: string;
  rencanaAksi: string;
  keteranganBuktiDukung: string;
  waktuPelaksanaan: string;
  uic: string;
  tindakLanjut: string;

  followUpStatus: string;
  saldoStatus: string;

  // Data lama tetap dipertahankan
  temuan: string;
  recommendation: string;
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
  no_temuan?: string | null;
  judul?: string | null;
  rencana_aksi?: string | null;
  keterangan_bukti_dukung?: string | null;
  waktu_pelaksanaan?: string | null;
  uic?: string | null;
  tindak_lanjut?: string | null;
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
  noTemuan: "",
  judul: "",
  rencanaAksi: "",
  keteranganBuktiDukung: "",
  waktuPelaksanaan: "",
  uic: "",
  tindakLanjut: "",

  followUpStatus: "BELUM_TL",
  saldoStatus: "BELUM_SALDO",

  // Data lama tetap dipertahankan
  temuan: "",
  recommendation: "",
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
        noTemuan: editingData.no_temuan || "",
        judul: editingData.judul || "",
        rencanaAksi: editingData.rencana_aksi || "",
        keteranganBuktiDukung: editingData.keterangan_bukti_dukung || "",
        waktuPelaksanaan: editingData.waktu_pelaksanaan?.substring(0, 10) || "",
        uic: editingData.uic || "",
        tindakLanjut: editingData.tindak_lanjut || "",

        followUpStatus: editingData.follow_up_status || "BELUM_TL",
        saldoStatus: editingData.saldo_status || "BELUM_SALDO",

        // Data lama tetap dimuat
        temuan: editingData.temuan || "",
        recommendation: editingData.recommendation || "",
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
      (item) =>
        !item.noTemuan.trim() || !item.judul.trim() || !item.rencanaAksi.trim()
    );

    if (hasIncompleteItem) {
      return "No Temuan, Judul, dan Rencana Aksi wajib diisi untuk setiap baris.";
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

          // DATA BARU
          no_temuan: items[0].noTemuan.trim(),
          judul: items[0].judul.trim(),
          rencana_aksi: items[0].rencanaAksi.trim(),
          keterangan_bukti_dukung: items[0].keteranganBuktiDukung.trim(),
          waktu_pelaksanaan: items[0].waktuPelaksanaan || null,
          uic: items[0].uic.trim(),
          tindak_lanjut: items[0].tindakLanjut.trim(),

          // STATUS TETAP DIPERTAHANKAN
          followUpStatus: items[0].followUpStatus,
          saldoStatus: items[0].saldoStatus,

          // DATA LAMA TETAP DIKIRIM
          temuan: items[0].temuan.trim(),
          recommendation: items[0].recommendation.trim(),
          keterangan_1: items[0].keterangan_1.trim(),
          keterangan_2: items[0].keterangan_2.trim(),
          keterangan_3: items[0].keterangan_3.trim(),
        }
      : {
          ...commonData,

          recommendations: items.map((item) => ({
            // DATA BARU
            no_temuan: item.noTemuan.trim(),
            judul: item.judul.trim(),
            rencana_aksi: item.rencanaAksi.trim(),
            keterangan_bukti_dukung: item.keteranganBuktiDukung.trim(),
            waktu_pelaksanaan: item.waktuPelaksanaan || null,
            uic: item.uic.trim(),
            tindak_lanjut: item.tindakLanjut.trim(),

            // STATUS TETAP DIPERTAHANKAN
            followUpStatus: item.followUpStatus,
            saldoStatus: item.saldoStatus,

            // DATA LAMA TETAP DIKIRIM
            temuan: item.temuan.trim(),
            recommendation: item.recommendation.trim(),
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
                    {/* DATA REKOMENDASI */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {/* NO TEMUAN */}
                      <div>
                        <label
                          htmlFor={`noTemuan-${index}`}
                          className={labelClass}
                        >
                          No Temuan <span className="text-red-500">*</span>
                        </label>

                        <input
                          id={`noTemuan-${index}`}
                          required
                          type="text"
                          value={item.noTemuan}
                          onChange={(event) =>
                            updateItem(index, "noTemuan", event.target.value)
                          }
                          placeholder="Contoh: 01"
                          className={inputClass}
                          disabled={loading}
                        />
                      </div>

                      {/* JUDUL */}
                      <div>
                        <label
                          htmlFor={`judul-${index}`}
                          className={labelClass}
                        >
                          Judul <span className="text-red-500">*</span>
                        </label>

                        <input
                          id={`judul-${index}`}
                          required
                          type="text"
                          value={item.judul}
                          onChange={(event) =>
                            updateItem(index, "judul", event.target.value)
                          }
                          placeholder="Masukkan judul temuan/rekomendasi"
                          className={inputClass}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* RENCANA AKSI */}
                    <div>
                      <label
                        htmlFor={`rencanaAksi-${index}`}
                        className={labelClass}
                      >
                        Rencana Aksi <span className="text-red-500">*</span>
                      </label>

                      <textarea
                        id={`rencanaAksi-${index}`}
                        required
                        rows={4}
                        value={item.rencanaAksi}
                        onChange={(event) =>
                          updateItem(index, "rencanaAksi", event.target.value)
                        }
                        placeholder="Tuliskan rencana aksi..."
                        className={`${inputClass} resize-y`}
                        disabled={loading}
                      />
                    </div>

                    {/* KETERANGAN / BUKTI DUKUNG */}
                    <div>
                      <label
                        htmlFor={`keteranganBuktiDukung-${index}`}
                        className={labelClass}
                      >
                        Keterangan / Bukti Dukung
                      </label>

                      <textarea
                        id={`keteranganBuktiDukung-${index}`}
                        rows={4}
                        value={item.keteranganBuktiDukung}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "keteranganBuktiDukung",
                            event.target.value
                          )
                        }
                        placeholder="Tuliskan keterangan atau bukti dukung..."
                        className={`${inputClass} resize-y`}
                        disabled={loading}
                      />
                    </div>

                    {/* WAKTU PELAKSANAAN & UIC */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {/* WAKTU PELAKSANAAN */}
                      <div>
                        <label
                          htmlFor={`waktuPelaksanaan-${index}`}
                          className={labelClass}
                        >
                          Waktu Pelaksanaan
                        </label>

                        <input
                          id={`waktuPelaksanaan-${index}`}
                          type="date"
                          value={item.waktuPelaksanaan}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "waktuPelaksanaan",
                              event.target.value
                            )
                          }
                          className={inputClass}
                          disabled={loading}
                        />
                      </div>

                      {/* UIC */}
                      <div>
                        <label htmlFor={`uic-${index}`} className={labelClass}>
                          UIC
                        </label>

                        <input
                          id={`uic-${index}`}
                          type="text"
                          value={item.uic}
                          onChange={(event) =>
                            updateItem(index, "uic", event.target.value)
                          }
                          placeholder="Masukkan UIC"
                          className={inputClass}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* TINDAK LANJUT */}
                    <div>
                      <label
                        htmlFor={`tindakLanjut-${index}`}
                        className={labelClass}
                      >
                        Tindak Lanjut
                      </label>

                      <textarea
                        id={`tindakLanjut-${index}`}
                        rows={4}
                        value={item.tindakLanjut}
                        onChange={(event) =>
                          updateItem(index, "tindakLanjut", event.target.value)
                        }
                        placeholder="Tuliskan tindak lanjut..."
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
