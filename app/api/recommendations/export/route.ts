import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const source = searchParams.get("source") || "";
    const followUpStatus = searchParams.get("followUpStatus") || "";
    const category = searchParams.get("category") || "";

    const conditions: string[] = [];
    const values: string[] = [];

    if (startDate) {
      values.push(startDate);
      conditions.push(`lha_date >= $${values.length}`);
    }

    if (endDate) {
      values.push(endDate);
      conditions.push(`lha_date <= $${values.length}`);
    }

    if (source && source !== "ALL") {
      values.push(source);
      conditions.push(`source = $${values.length}`);
    }

    if (followUpStatus && followUpStatus !== "ALL") {
      values.push(followUpStatus);
      conditions.push(`follow_up_status = $${values.length}`);
    }

    if (category && category !== "ALL") {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT
        id,
        source,
        category,
        lha_number,
        lha_date,
        recommendation_count,
        follow_up_status,
        saldo_status,
        description
      FROM recommendations
      ${whereClause}
      ORDER BY lha_date ASC, id ASC
      `,
      values
    );

    const rows = result.rows.map((item, index) => ({
      No: index + 1,
      APF: item.source,
      Kategori: item.category,
      "LHA / LHP / Nomor": item.lha_number,
      Tanggal: item.lha_date
        ? new Date(item.lha_date).toLocaleDateString("id-ID")
        : "",
      "Saldo (Rek.)":
        item.saldo_status === "MASUK_SALDO"
          ? Number(item.recommendation_count)
          : 0,
      "Belum Tindak Lanjut":
        item.follow_up_status === "BELUM_TL"
          ? Number(item.recommendation_count)
          : 0,
      "TL Belum Tuntas":
        item.follow_up_status === "BELUM_TUNTAS"
          ? Number(item.recommendation_count)
          : 0,
      "TL Sudah Tuntas":
        item.follow_up_status === "SUDAH_TUNTAS"
          ? Number(item.recommendation_count)
          : 0,
      "Status Saldo": item.saldo_status,
      "Status Tindak Lanjut": item.follow_up_status,
      Keterangan: item.description || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 10 },
      { wch: 28 },
      { wch: 35 },
      { wch: 18 },
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 25 },
      { wch: 40 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap APF");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Rekap_APF.xlsx"',
      },
    });
  } catch (error) {
    console.error("EXPORT ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal membuat file Excel",
      },
      { status: 500 }
    );
  }
}
