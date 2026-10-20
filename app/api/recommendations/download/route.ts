import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function dateValue(value: unknown): string {
  if (!value) return "-";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function followUpLabel(value: string): string {
  switch (value) {
    case "BELUM_TL":
      return "Belum TL";
    case "SUDAH_TL":
    case "BELUM_TUNTAS":
      return "Sudah TL";
    case "SUDAH_TUNTAS":
      return "Sudah Tuntas";
    default:
      return value || "-";
  }
}

function saldoLabel(value: string): string {
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

function createTable(
  headers: string[],
  rows: string[][],
  columnWidths: number[]
) {
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "CBD5E1",
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (header, index) =>
        new TableCell({
          width: {
            size: columnWidths[index],
            type: WidthType.DXA,
          },
          shading: {
            fill: "0B1F3A",
            type: ShadingType.CLEAR,
          },
          margins: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100,
          },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: header,
                  bold: true,
                  color: "FFFFFF",
                  size: 16,
                }),
              ],
            }),
          ],
        })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (value, index) =>
            new TableCell({
              width: {
                size: columnWidths[index],
                type: WidthType.DXA,
              },
              margins: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100,
              },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: textValue(value),
                      size: 16,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: {
      size: columnWidths.reduce((sum, width) => sum + width, 0),
      type: WidthType.DXA,
    },
    columnWidths,
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json(
        {
          ok: false,
          message: "ID rekomendasi tidak valid.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        id,
        source,
        category,
        lha_number,
        lha_date,
        tahun_periode,
        recommendation_number,
        recommendation_count,
        temuan,
        recommendation,
        description,
        keterangan_1,
        keterangan_2,
        keterangan_3,
        no_temuan,
        judul,
        rencana_aksi,
        keterangan_bukti_dukung,
        waktu_pelaksanaan,
        uic,
        tindak_lanjut,
        follow_up_status,
        saldo_status
      FROM public.recommendations
      WHERE id = $1
      LIMIT 1
      `,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Data rekomendasi tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    const item = result.rows[0];

    // Kolom ringkasan mengikuti tabel pada halaman Laporan APF.
    const reportHeaders = [
      "No",
      "APF",
      "LHA / LHP",
      "Tanggal",
      "Kategori",
      "Rek.",
      "Saldo",
      "Tindak Lanjut",
    ];

    const reportValues = [
      textValue(item.recommendation_number ?? item.id),
      textValue(item.source),
      textValue(item.lha_number),
      dateValue(item.lha_date),
      textValue(item.category),
      textValue(item.recommendation_count),
      saldoLabel(item.saldo_status),
      followUpLabel(item.follow_up_status),
    ];

    // Total lebar kolom dibuat sesuai halaman A4 landscape.
    const reportWidths = [800, 700, 2500, 1600, 1800, 1200, 1500, 5600];

    const reportTable = createTable(
      reportHeaders,
      [reportValues],
      reportWidths
    );

    // Detail tambahan disajikan dalam tabel dua kolom
    // agar teks panjang tetap mudah dibaca.
    const detailHeaders = ["Kolom", "Isi"];

    const detailRows = [
      ["Tahun Periode Monitoring", textValue(item.tahun_periode)],
      ["ID Rekomendasi", textValue(item.id)],
      ["No Temuan", textValue(item.no_temuan)],
      ["Judul", textValue(item.judul)],
      ["Rencana Aksi", textValue(item.rencana_aksi)],
      ["Keterangan / Bukti Dukung", textValue(item.keterangan_bukti_dukung)],
      ["Waktu Pelaksanaan", dateValue(item.waktu_pelaksanaan)],
      ["UIC", textValue(item.uic)],
      ["Tindak Lanjut", textValue(item.tindak_lanjut)],
      ["Temuan (data lama)", textValue(item.temuan)],
      ["Rekomendasi (data lama)", textValue(item.recommendation)],
      ["Deskripsi", textValue(item.description)],
      ["Keterangan 1", textValue(item.keterangan_1)],
      ["Keterangan 2", textValue(item.keterangan_2)],
      ["Keterangan 3", textValue(item.keterangan_3)],
    ];

    const detailTable = createTable(detailHeaders, detailRows, [3500, 12200]);

    const document = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: PageOrientation.LANDSCAPE,
                width: 16838,
                height: 11906,
              },
              margin: {
                top: 567,
                right: 567,
                bottom: 567,
                left: 567,
              },
            },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({
                  text: "LAPORAN REKOMENDASI APF",
                  bold: true,
                }),
              ],
              spacing: {
                after: 200,
              },
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Periode Monitoring: ",
                  bold: true,
                }),
                new TextRun({
                  text: textValue(item.tahun_periode),
                }),
              ],
              spacing: {
                after: 200,
              },
            }),

            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              text: "Ringkasan Rekomendasi",
              spacing: {
                before: 200,
                after: 150,
              },
            }),

            reportTable,

            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              text: "Detail Rekomendasi",
              spacing: {
                before: 300,
                after: 150,
              },
            }),

            detailTable,

            new Paragraph({
              children: [
                new TextRun({
                  text: "Dokumen dibuat dari APF Monitoring Center.",
                  italics: true,
                  color: "64748B",
                  size: 18,
                }),
              ],
              spacing: {
                before: 250,
              },
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(document);

    const safeLhaNumber = String(item.lha_number || "LHA")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);

    const recommendationNumber = Number(item.recommendation_number ?? item.id);

    const filename = `Rekomendasi-${safeLhaNumber}-${recommendationNumber}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("DOWNLOAD WORD RECOMMENDATION ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal membuat dokumen Word.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
