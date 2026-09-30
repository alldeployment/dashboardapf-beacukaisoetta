import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        capaian_manual,
        updated_at
      FROM dashboard_capaian
      WHERE id = 1
      LIMIT 1
    `);

    const row = result.rows[0];

    if (!row) {
      // Kalau datanya belum ada, buat data awal
      const insertResult = await pool.query(`
        INSERT INTO dashboard_capaian (
          id,
          capaian_manual,
          updated_at
        )
        VALUES (1, 0, CURRENT_TIMESTAMP)
        RETURNING id, capaian_manual, updated_at
      `);

      return NextResponse.json({
        ok: true,
        data: insertResult.rows[0],
      });
    }

    return NextResponse.json({
      ok: true,
      data: row,
    });
  } catch (error) {
    console.error("GET /api/dashboard/capaian ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal mengambil capaian keseluruhan.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    let capaian = Number(body?.capaian_manual);

    if (Number.isNaN(capaian)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Capaian harus berupa angka.",
        },
        { status: 400 }
      );
    }

    // Batasi 0 - 100
    capaian = Math.max(0, Math.min(100, capaian));

    const result = await pool.query(
      `
      INSERT INTO dashboard_capaian (
        id,
        capaian_manual,
        updated_at
      )
      VALUES (
        1,
        $1,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id)
      DO UPDATE SET
        capaian_manual = EXCLUDED.capaian_manual,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id,
        capaian_manual,
        updated_at
      `,
      [capaian]
    );

    return NextResponse.json({
      ok: true,
      data: result.rows[0],
      message: "Capaian keseluruhan berhasil disimpan.",
    });
  } catch (error) {
    console.error("PUT /api/dashboard/capaian ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal menyimpan capaian keseluruhan.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
