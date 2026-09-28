import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

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

function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function detectSource(text: string): string {
  const upper = text.toUpperCase();

  if (upper.includes("ITJEN") || upper.includes("INSPEKTORAT JENDERAL")) {
    return "ITJEN";
  }

  return "BPK";
}

function detectFollowUpStatus(text: string): string {
  const upper = text.toUpperCase();

  if (
    upper.includes("SUDAH TUNTAS") ||
    upper.includes("TELAH TUNTAS") ||
    upper.includes("SELESAI")
  ) {
    return "SUDAH_TUNTAS";
  }

  if (
    upper.includes("SUDAH TINDAK LANJUT") ||
    upper.includes("TELAH DITINDAKLANJUTI") ||
    upper.includes("TELAH DILAKUKAN")
  ) {
    return "SUDAH_TL";
  }

  return "BELUM_TL";
}

function detectSaldoStatus(text: string): string {
  const upper = text.toUpperCase();

  if (
    upper.includes("TIDAK RELEVAN") ||
    upper.includes("TIDAK TERKAIT SALDO")
  ) {
    return "TIDAK_RELEVAN";
  }

  if (upper.includes("MASUK SALDO") || upper.includes("TELAH MASUK SALDO")) {
    return "MASUK_SALDO";
  }

  return "BELUM_SALDO";
}

function createPreviewFromText(text: string, source?: string): PreviewData {
  const detectedSource = source || detectSource(text);

  return {
    source: detectedSource,
    category: "",
    lha_number: "",
    lha_date: "",
    recommendation_count: 1,
    follow_up_status: detectFollowUpStatus(text),
    saldo_status: detectSaldoStatus(text),
    recommendation: "",
    description: text.slice(0, 5000),
  };
}

function parseExcel(buffer: Buffer): PreviewData[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  if (rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const source =
      cleanText(
        row.source ?? row.Source ?? row.SOURCE ?? row.sumber ?? row.Sumber
      ) || "BPK";

    const category = cleanText(
      row.category ??
        row.Category ??
        row.CATEGORY ??
        row.kategori ??
        row.Kategori
    );

    const lhaNumber = cleanText(
      row.lha_number ??
        row.LHA_NUMBER ??
        row.lhaNumber ??
        row["No LHA"] ??
        row["Nomor LHA"] ??
        row["No. LHA"]
    );

    const lhaDate = cleanText(
      row.lha_date ??
        row.LHA_DATE ??
        row.lhaDate ??
        row["Tanggal LHA"] ??
        row["Tgl LHA"]
    );

    const recommendationCountRaw =
      row.recommendation_count ??
      row.RecommendationCount ??
      row["Jumlah Rekomendasi"] ??
      row["Jumlah"];

    const recommendationCount =
      Number(recommendationCountRaw) > 0 ? Number(recommendationCountRaw) : 1;

    const followUpStatus =
      cleanText(
        row.follow_up_status ??
          row.FOLLOW_UP_STATUS ??
          row.followUpStatus ??
          row["Status Tindak Lanjut"] ??
          row["Status"]
      ) || "BELUM_TL";

    const saldoStatus =
      cleanText(
        row.saldo_status ??
          row.SALDO_STATUS ??
          row.saldoStatus ??
          row["Status Saldo"]
      ) || "BELUM_SALDO";

    const recommendation = cleanText(
      row.recommendation ??
        row.Recommendation ??
        row.RECOMMENDATION ??
        row["Rekomendasi"] ??
        row["REKOMENDASI"]
    );

    const description = cleanText(
      row.description ??
        row.Description ??
        row.DESCRIPTION ??
        row["Keterangan"] ??
        row["Deskripsi"]
    );

    return {
      source,
      category,
      lha_number: lhaNumber,
      lha_date: lhaDate,
      recommendation_count: recommendationCount,
      follow_up_status: followUpStatus,
      saldo_status: saldoStatus,
      recommendation,
      description,
    };
  });
}

async function parseDocx(buffer: Buffer): Promise<PreviewData[]> {
  const result = await mammoth.extractRawText({
    buffer,
  });

  const text = result.value.trim();

  if (!text) {
    return [];
  }

  return [createPreviewFromText(text)];
}

async function parsePdf(buffer: Buffer): Promise<PreviewData[]> {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    const text = result.text?.trim() || "";

    if (!text) {
      return [];
    }

    return [createPreviewFromText(text)];
  } finally {
    await parser.destroy();
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    /*
     * Cast ini digunakan supaya TypeScript tidak bermasalah
     * dengan tipe FormData pada project.
     */
    const formDataReader = formData as unknown as {
      get: (name: string) => File | string | null;
    };

    const file = formDataReader.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "File tidak ditemukan.",
        },
        {
          status: 400,
        }
      );
    }

    const fileName = file.name.toLowerCase();

    const buffer = Buffer.from(await file.arrayBuffer());

    let preview: PreviewData[] = [];

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      preview = parseExcel(buffer);
    } else if (fileName.endsWith(".docx")) {
      preview = await parseDocx(buffer);
    } else if (fileName.endsWith(".pdf")) {
      preview = await parsePdf(buffer);
    } else {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Format file tidak didukung. Gunakan XLSX, XLS, PDF, atau DOCX.",
        },
        {
          status: 400,
        }
      );
    }

    if (preview.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Dokumen berhasil dibaca, tetapi tidak ditemukan data yang dapat ditampilkan.",
          total: 0,
          preview: [],
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Dokumen berhasil dibaca.",
      total: preview.length,
      preview,
    });
  } catch (error) {
    console.error("IMPORT ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat membaca dokumen.",
      },
      {
        status: 500,
      }
    );
  }
}
