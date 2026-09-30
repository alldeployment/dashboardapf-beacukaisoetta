import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * Menghitung capaian otomatis berdasarkan
 * status tindak lanjut.
 *
 * BELUM_TL     = 0%
 * SUDAH_TL     = 50%
 * SUDAH_TUNTAS = 100%
 */
function calculateCapaian(followUpStatus: string): number {
  switch (followUpStatus) {
    case "BELUM_TL":
      return 0;

    case "SUDAH_TL":
      return 50;

    case "SUDAH_TUNTAS":
      return 100;

    default:
      return 0;
  }
}

/**
 * GET
 *
 * Mengambil seluruh rekomendasi.
 * Setiap row = 1 rekomendasi.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const lhaNumber = searchParams.get("lhaNumber");
    const source = searchParams.get("source");

    let query = `
      SELECT
        id,
        source,
        category,
        lha_number,
        lha_date,
        recommendation_number,
        recommendation_count,
        temuan,
        recommendation,

        description,
        keterangan_1,
        keterangan_2,
        keterangan_3,

        follow_up_status,
        saldo_status,
        capaian,
        created_at,
        updated_at
      FROM recommendations
    `;

    const values: string[] = [];
    const conditions: string[] = [];

    if (lhaNumber) {
      values.push(lhaNumber);
      conditions.push(`lha_number = $${values.length}`);
    }

    if (source) {
      values.push(source);
      conditions.push(`source = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += `
      ORDER BY
        lha_number ASC,
        recommendation_number ASC NULLS LAST,
        created_at ASC
    `;

    const result = await pool.query(query, values);

    /**
     * Capaian tetap dihitung otomatis
     * berdasarkan status tindak lanjut.
     */
    const data = result.rows.map((row) => ({
      ...row,
      capaian: calculateCapaian(row.follow_up_status),
    }));

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("GET RECOMMENDATIONS ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data rekomendasi.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST
 *
 * Menambahkan satu atau beberapa rekomendasi
 * dalam satu LHA/LHP.
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const { source, category, lhaNumber, lhaDate, recommendations } = body;

    if (!source || !category || !lhaNumber || !lhaDate) {
      return NextResponse.json(
        {
          ok: false,
          message: "Source, kategori, nomor LHA, dan tanggal LHA wajib diisi.",
        },
        { status: 400 }
      );
    }

    let recommendationList = recommendations;

    /**
     * Mendukung format lama.
     */
    if (!Array.isArray(recommendationList)) {
      recommendationList = [
        {
          temuan: body.temuan || "",
          recommendation: body.recommendation || "",

          keterangan_1: body.keterangan_1 || "",
          keterangan_2: body.keterangan_2 || "",
          keterangan_3: body.keterangan_3 || "",

          // Tetap dukung data lama
          description: body.description || "",

          followUpStatus: body.followUpStatus,
          saldoStatus: body.saldoStatus,
        },
      ];
    }

    if (recommendationList.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Minimal harus ada satu rekomendasi.",
        },
        { status: 400 }
      );
    }

    const allowedFollowUp = ["BELUM_TL", "SUDAH_TL", "SUDAH_TUNTAS"];

    const allowedSaldo = ["MASUK_SALDO", "BELUM_SALDO", "TIDAK_RELEVAN"];

    /**
     * Validasi setiap rekomendasi.
     */
    for (let i = 0; i < recommendationList.length; i++) {
      const item = recommendationList[i];

      if (!item.followUpStatus) {
        return NextResponse.json(
          {
            ok: false,
            message: `Status tindak lanjut rekomendasi ke-${
              i + 1
            } wajib diisi.`,
          },
          { status: 400 }
        );
      }

      if (!item.saldoStatus) {
        return NextResponse.json(
          {
            ok: false,
            message: `Status saldo rekomendasi ke-${i + 1} wajib diisi.`,
          },
          { status: 400 }
        );
      }

      if (!allowedFollowUp.includes(item.followUpStatus)) {
        return NextResponse.json(
          {
            ok: false,
            message: `Status tindak lanjut rekomendasi ke-${
              i + 1
            } tidak valid.`,
          },
          { status: 400 }
        );
      }

      if (!allowedSaldo.includes(item.saldoStatus)) {
        return NextResponse.json(
          {
            ok: false,
            message: `Status saldo rekomendasi ke-${i + 1} tidak valid.`,
          },
          { status: 400 }
        );
      }
    }

    await client.query("BEGIN");

    /**
     * Cari nomor rekomendasi terakhir
     * pada LHA/LHP yang sama.
     */
    const lastNumberResult = await client.query(
      `
      SELECT
        COALESCE(MAX(recommendation_number), 0)::int
        AS last_number
      FROM recommendations
      WHERE lha_number = $1
      `,
      [lhaNumber]
    );

    let nextNumber = Number(lastNumberResult.rows[0]?.last_number || 0) + 1;

    const insertedRows = [];

    /**
     * Masukkan seluruh rekomendasi.
     */
    for (const item of recommendationList) {
      const capaian = calculateCapaian(item.followUpStatus);

      const result = await client.query(
        `
        INSERT INTO recommendations (
          source,
          category,
          lha_number,
          lha_date,
          recommendation_number,
          recommendation_count,

          temuan,
          recommendation,

          description,
          keterangan_1,
          keterangan_2,
          keterangan_3,

          follow_up_status,
          saldo_status,
          capaian
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,

          $7,
          $8,

          $9,
          $10,
          $11,
          $12,

          $13,
          $14,
          $15
        )
        RETURNING *
        `,
        [
          source,
          category,
          lhaNumber,
          lhaDate,
          nextNumber,
          recommendationList.length,

          item.temuan || "",
          item.recommendation || "",

          // Data lama tetap dipertahankan
          item.description || "",

          item.keterangan_1 || "",
          item.keterangan_2 || "",
          item.keterangan_3 || "",

          item.followUpStatus,
          item.saldoStatus,
          capaian,
        ]
      );

      insertedRows.push(result.rows[0]);

      nextNumber++;
    }

    /**
     * Pastikan jumlah rekomendasi
     * pada LHA/LHP sama.
     */
    await client.query(
      `
      UPDATE recommendations
      SET
        recommendation_count = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE lha_number = $2
      `,
      [recommendationList.length, lhaNumber]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        ok: true,
        message: `${insertedRows.length} rekomendasi berhasil ditambahkan.`,
        data: insertedRows,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("POST RECOMMENDATIONS ERROR:", error);

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
  } finally {
    client.release();
  }
}

/**
 * PUT
 *
 * Mengubah data rekomendasi.
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
      recommendationNumber,

      temuan,
      recommendation,

      description,
      keterangan_1,
      keterangan_2,
      keterangan_3,

      followUpStatus,
      saldoStatus,
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

    const allowedFollowUp = ["BELUM_TL", "SUDAH_TL", "SUDAH_TUNTAS"];

    const allowedSaldo = ["MASUK_SALDO", "BELUM_SALDO", "TIDAK_RELEVAN"];

    if (!allowedFollowUp.includes(followUpStatus)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Status tindak lanjut tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!allowedSaldo.includes(saldoStatus)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Status saldo tidak valid.",
        },
        { status: 400 }
      );
    }

    /**
     * Capaian otomatis.
     */
    const capaian = calculateCapaian(followUpStatus);

    const result = await pool.query(
      `
      UPDATE recommendations
      SET
        source = $1,
        category = $2,
        lha_number = $3,
        lha_date = $4,

        recommendation_number =
          COALESCE($5, recommendation_number),

        temuan = $6,
        recommendation = $7,

        description = $8,
        keterangan_1 = $9,
        keterangan_2 = $10,
        keterangan_3 = $11,

        follow_up_status = $12,
        saldo_status = $13,
        capaian = $14,

        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
      `,
      [
        source,
        category,
        lhaNumber,
        lhaDate,
        recommendationNumber || null,

        temuan || "",
        recommendation || "",

        description || "",
        keterangan_1 || "",
        keterangan_2 || "",
        keterangan_3 || "",

        followUpStatus,
        saldoStatus,
        capaian,

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
    console.error("PUT RECOMMENDATION ERROR:", error);

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
 *
 * Menghapus satu rekomendasi.
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

    const deletedLhaNumber = result.rows[0].lha_number;

    /**
     * Hitung ulang jumlah rekomendasi
     * pada LHA/LHP terkait.
     */
    await pool.query(
      `
      UPDATE recommendations
      SET
        recommendation_count = (
          SELECT COUNT(*)
          FROM recommendations r2
          WHERE r2.lha_number =
            recommendations.lha_number
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE lha_number = $1
      `,
      [deletedLhaNumber]
    );

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
