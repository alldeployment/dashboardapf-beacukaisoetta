"use client";

import { useRef, useState } from "react";

type PreviewData = {
  source: string;
  category: string;
  lha_number: string;
  lha_date: string;
  recommendation_count: number;
  follow_up_status: string;
  saldo_status: string;
  recommendation: string;
  description: string;
};

type Props = {
  onClose: () => void;
  onImported?: () => void;
};

const EMPTY_DATA: PreviewData = {
  source: "",
  category: "",
  lha_number: "",
  lha_date: "",
  recommendation_count: 1,
  follow_up_status: "",
  saldo_status: "",
  recommendation: "",
  description: "",
};

export default function ImportDocumentModal({ onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [preview, setPreview] = useState<PreviewData | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    setError("");
    setSuccess("");
    setPreview(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();

    const allowedExtensions = ["xlsx", "xls", "pdf", "docx"];

    if (!extension || !allowedExtensions.includes(extension)) {
      setError(
        "Format file tidak didukung. Gunakan XLSX, XLS, PDF, atau DOCX."
      );

      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    setFile(selectedFile);
  }

  async function handleReadDocument() {
    if (!file) {
      setError("Silakan pilih dokumen terlebih dahulu.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setPreview(null);

      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch("/api/recommendations/import", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";

      let result: any = {};

      if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();

        throw new Error(
          `Server mengembalikan response yang tidak valid. Status: ${
            response.status
          }. ${text.substring(0, 300)}`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.message || `Gagal membaca dokumen. HTTP ${response.status}`
        );
      }

      if (!result?.ok) {
        throw new Error(result?.message || "Dokumen tidak dapat diproses.");
      }

      const firstData =
        Array.isArray(result.preview) && result.preview.length > 0
          ? result.preview[0]
          : null;

      if (!firstData) {
        throw new Error(
          "Dokumen berhasil diproses, tetapi tidak ada data yang dapat ditampilkan."
        );
      }

      const data: PreviewData = {
        source: firstData.source || "",
        category: firstData.category || "",
        lha_number: firstData.lha_number || "",
        lha_date: firstData.lha_date || "",
        recommendation_count: Number(firstData.recommendation_count) || 1,
        follow_up_status: firstData.follow_up_status || "",
        saldo_status: firstData.saldo_status || "",
        recommendation: firstData.recommendation || "",
        description: firstData.description || "",
      };

      setPreview(data);

      setSuccess("Dokumen berhasil dibaca. Silakan periksa hasilnya.");
    } catch (error) {
      console.error("IMPORT DOCUMENT ERROR:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat membaca dokumen."
      );
    } finally {
      setLoading(false);
    }
  }

  function updatePreview(field: keyof PreviewData, value: string | number) {
    setPreview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  function resetFile() {
    setFile(null);
    setPreview(null);
    setError("");
    setSuccess("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* ================= HEADER ================= */}

        <div className="flex items-center justify-between border-b border-slate-200 bg-[#071426] px-6 py-5 text-white">
          <div>
            <h2 className="text-xl font-bold">Import Dokumen</h2>

            <p className="mt-1 text-sm text-slate-300">
              Baca dokumen LHA/LHP untuk melihat hasil pembacaan
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>

        {/* ================= CONTENT ================= */}

        <div className="overflow-y-auto p-6">
          {/* ================= UPLOAD ================= */}

          {!preview && (
            <div className="space-y-5">
              <div
                onClick={() => inputRef.current?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center transition hover:border-[#D4A72C] hover:bg-amber-50/30"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#071426] text-3xl text-white">
                  ↑
                </div>

                <h3 className="text-lg font-bold text-slate-800">
                  Pilih Dokumen
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Upload file untuk dibaca sistem
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  XLSX • XLS • PDF • DOCX
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* FILE */}

              {file && (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">
                      📄
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {file.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={resetFile}
                    className="ml-4 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              )}

              {/* INFO */}

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex gap-3">
                  <span className="text-lg">ℹ️</span>

                  <div>
                    <p className="font-semibold text-blue-900">Mode Preview</p>

                    <p className="mt-1 text-sm leading-6 text-blue-800">
                      Sistem hanya membaca dokumen dan menampilkan hasilnya.
                      Data belum disimpan ke database.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= PREVIEW ================= */}

          {preview && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-amber-900">
                    Hasil Pembacaan Dokumen
                  </p>

                  <p className="mt-1 text-sm text-amber-800">
                    Periksa data hasil pembacaan. Kamu masih bisa mengubahnya.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetFile}
                  className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Pilih Dokumen Lain
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* SOURCE */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Sumber
                  </label>

                  <select
                    value={preview.source}
                    onChange={(e) => updatePreview("source", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Pilih Sumber</option>

                    <option value="BPK">BPK</option>

                    <option value="ITJEN">ITJEN</option>
                  </select>
                </div>

                {/* CATEGORY */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Kategori
                  </label>

                  <input
                    value={preview.category}
                    onChange={(e) => updatePreview("category", e.target.value)}
                    placeholder="Contoh: Keuangan"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black placeholder:text-slate-400 outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                {/* LHA */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nomor LHA / LHP
                  </label>

                  <input
                    value={preview.lha_number}
                    onChange={(e) =>
                      updatePreview("lha_number", e.target.value)
                    }
                    placeholder="Nomor LHA/LHP"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black placeholder:text-slate-400 outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                {/* DATE */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Tanggal LHA / LHP
                  </label>

                  <input
                    type="date"
                    value={preview.lha_date}
                    onChange={(e) => updatePreview("lha_date", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                {/* COUNT */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Jumlah Rekomendasi
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={preview.recommendation_count}
                    onChange={(e) =>
                      updatePreview(
                        "recommendation_count",
                        Number(e.target.value) || 1
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                {/* FOLLOW UP */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Status Tindak Lanjut
                  </label>

                  <select
                    value={preview.follow_up_status}
                    onChange={(e) =>
                      updatePreview("follow_up_status", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Pilih Status</option>

                    <option value="BELUM_TL">Belum Tindak Lanjut</option>

                    <option value="SUDAH_TL">Sudah Tindak Lanjut</option>

                    <option value="SUDAH_TUNTAS">Sudah Tuntas</option>
                  </select>
                </div>

                {/* SALDO */}

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Status Saldo
                  </label>

                  <select
                    value={preview.saldo_status}
                    onChange={(e) =>
                      updatePreview("saldo_status", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Pilih Status Saldo</option>

                    <option value="MASUK_SALDO">Masuk Saldo</option>

                    <option value="BELUM_SALDO">Belum Masuk Saldo</option>

                    <option value="TIDAK_RELEVAN">Tidak Relevan</option>
                  </select>
                </div>

                {/* ================= RECOMMENDATION ================= */}

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Rekomendasi
                  </label>

                  <textarea
                    rows={7}
                    value={preview.recommendation}
                    onChange={(e) =>
                      updatePreview("recommendation", e.target.value)
                    }
                    placeholder="Isi rekomendasi..."
                    className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black placeholder:text-slate-400 outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                {/* ================= DESCRIPTION ================= */}

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Keterangan
                  </label>

                  <textarea
                    rows={5}
                    value={preview.description}
                    onChange={(e) =>
                      updatePreview("description", e.target.value)
                    }
                    placeholder="Keterangan tambahan..."
                    className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black placeholder:text-slate-400 outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-amber-100"
                  />
                </div>
              </div>

              {/* DATABASE INFO */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-700">Belum disimpan</p>

                <p className="mt-1 text-sm text-slate-500">
                  Data ini hanya preview. Database PostgreSQL belum diubah.
                </p>
              </div>
            </div>
          )}

          {/* ================= ERROR ================= */}

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-800">
                Gagal membaca dokumen
              </p>

              <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">
                {error}
              </p>
            </div>
          )}

          {/* ================= SUCCESS ================= */}

          {success && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="font-semibold text-green-800">Berhasil</p>

              <p className="mt-1 text-sm text-green-700">{success}</p>
            </div>
          )}
        </div>

        {/* ================= FOOTER ================= */}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Tutup
          </button>

          {!preview && (
            <button
              type="button"
              onClick={handleReadDocument}
              disabled={!file || loading}
              className="rounded-xl bg-[#071426] px-5 py-3 text-sm font-semibold text-white hover:bg-[#10233d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Membaca Dokumen..." : "Baca Dokumen"}
            </button>
          )}

          {preview && (
            <button
              type="button"
              onClick={() => {
                if (onImported) {
                  onImported();
                } else {
                  onClose();
                }
              }}
              className="rounded-xl bg-[#D4A72C] px-5 py-3 text-sm font-semibold text-[#071426] hover:bg-[#e5ba45]"
            >
              Selesai Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
