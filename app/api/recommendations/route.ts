import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * GET
 * Mengambil seluruh data rekomendasi
 */
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        source,
        category,
        lha_number,
        lha_date,
        recommendation_count,
        follow_up_status,
        saldo_status,
        recommendation,
        description,
        created_at,
        updated_at
      FROM recommendations
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("GET RECOMMENDATIONS ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal mengambil data rekomendasi.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST
 * Menambahkan rekomendasi baru
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      source,
      category,
      lhaNumber,
      lhaDate,
      recommendationCount,
      followUpStatus,
      saldoStatus,
      recommendation,
      description,
    } = body;

    if (
      !source ||
      !category ||
      !lhaNumber ||
      !lhaDate ||
      !followUpStatus ||
      !saldoStatus
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Source, kategori, nomor LHA, tanggal LHA, status tindak lanjut, dan status saldo wajib diisi.",
        },
        { status: 400 }
      );
    }

    const count =
      Number(recommendationCount) > 0 ? Number(recommendationCount) : 1;

    const result = await pool.query(
      `
      INSERT INTO recommendations (
        source,
        category,
        lha_number,
        lha_date,
        recommendation_count,
        follow_up_status,
        saldo_status,
        recommendation,
        description
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        source,
        category,
        lhaNumber,
        lhaDate,
        count,
        followUpStatus,
        saldoStatus,
        recommendation || "",
        description || "",
      ]
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Rekomendasi berhasil ditambahkan.",
        data: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST RECOMMENDATION ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menambahkan rekomendasi.",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT
 * Mengubah rekomendasi
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      source,
      category,
      lhaNumber,
      lhaDate,
      recommendationCount,
      followUpStatus,
      saldoStatus,
      recommendation,
      description,
    } = body;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          message: "ID rekomendasi wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (
      !source ||
      !category ||
      !lhaNumber ||
      !lhaDate ||
      !followUpStatus ||
      !saldoStatus
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Source, kategori, nomor LHA, tanggal LHA, status tindak lanjut, dan status saldo wajib diisi.",
        },
        { status: 400 }
      );
    }

    const count =
      Number(recommendationCount) > 0 ? Number(recommendationCount) : 1;

    const result = await pool.query(
      `
      UPDATE recommendations
      SET
        source = $1,
        category = $2,
        lha_number = $3,
        lha_date = $4,
        recommendation_count = $5,
        follow_up_status = $6,
        saldo_status = $7,
        recommendation = $8,
        description = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
      `,
      [
        source,
        category,
        lhaNumber,
        lhaDate,
        count,
        followUpStatus,
        saldoStatus,
        recommendation || "",
        description || "",
        id,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Data rekomendasi tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Rekomendasi berhasil diperbarui.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("PUT RECOMMENDATIONS ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal memperbarui rekomendasi.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE
 * Menghapus rekomendasi berdasarkan ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          message: "ID rekomendasi wajib diisi.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      DELETE FROM recommendations
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Data rekomendasi tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Rekomendasi berhasil dihapus.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE RECOMMENDATION ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menghapus rekomendasi.",
      },
      { status: 500 }
    );
  }
}
