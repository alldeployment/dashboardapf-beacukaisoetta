import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * Menghitung capaian keseluruhan berdasarkan
 * jumlah status tindak lanjut.
 *
 * Rumus Excel:
 *
 * ((70% × TL Belum Tuntas) + (100% × TL Sudah Tuntas))
 * / Saldo (Rek.)
 */
function calculateCapaian(
  saldo: number,
  tlBelumTuntas: number,
  tlSudahTuntas: number
): number {
  if (saldo <= 0) {
    return 0;
  }

  return (0.7 * tlBelumTuntas + tlSudahTuntas) / saldo;
}

/**
 * Menghitung indeks capaian.
 *
 * Rumus Excel:
 *
 * =MIN(I7/62*100,120%)
 *
 * Karena nilai capaian disimpan sebagai decimal:
 * 93,93% = 0.9393
 *
 * maka:
 * (0.9393 / 62) * 100
 *
 * hasil maksimum = 1.2 = 120%
 */
function calculateIndeksCapaian(capaian: number): number {
  return Math.min((capaian / 62) * 100, 1.2);
}

export async function GET() {
  try {
    /**
     * Ambil capaian manual yang sudah ada.
     * Data manual TIDAK dihapus.
     */
    const manualResult = await pool.query(`
      SELECT
        id,
        capaian_manual,
        updated_at
      FROM dashboard_capaian
      WHERE id = 1
      LIMIT 1
    `);

    let manualRow = manualResult.rows[0];

    /**
     * Kalau data manual belum ada,
     * buat data awal.
     */
    if (!manualRow) {
      const insertResult = await pool.query(`
        INSERT INTO dashboard_capaian (
          id,
          capaian_manual,
          updated_at
        )
        VALUES (1, 0, CURRENT_TIMESTAMP)
        RETURNING id, capaian_manual, updated_at
      `);

      manualRow = insertResult.rows[0];
    }

    /**
     * Hitung jumlah seluruh rekomendasi
     * berdasarkan status tindak lanjut.
     *
     * E = Saldo (Rek.)
     * F = Belum TL
     * G = TL Belum Tuntas
     * H = TL Sudah Tuntas
     */
    const summaryResult = await pool.query(`
  SELECT
    COALESCE(SUM(recommendation_count), 0)::int AS saldo,

    COALESCE(
      SUM(recommendation_count)
      FILTER (
        WHERE follow_up_status = 'BELUM_TL'
      ),
      0
    )::int AS belum_tl,

    COALESCE(
      SUM(recommendation_count)
      FILTER (
        WHERE follow_up_status = 'SUDAH_TL'
      ),
      0
    )::int AS tl_belum_tuntas,

    COALESCE(
      SUM(recommendation_count)
      FILTER (
        WHERE follow_up_status = 'SUDAH_TUNTAS'
      ),
      0
    )::int AS tl_sudah_tuntas

  FROM recommendations
`);

    const summary = summaryResult.rows[0];

    const saldo = Number(summary?.saldo || 0);
    const belumTL = Number(summary?.belum_tl || 0);
    const tlBelumTuntas = Number(summary?.tl_belum_tuntas || 0);
    const tlSudahTuntas = Number(summary?.tl_sudah_tuntas || 0);

    /**
     * Capaian otomatis sesuai rumus Excel.
     *
     * Contoh:
     * saldo = 61
     * tlBelumTuntas = 9
     * tlSudahTuntas = 51
     *
     * hasil = 0.9393 = 93.93%
     */
    const capaianOtomatis = calculateCapaian(
      saldo,
      tlBelumTuntas,
      tlSudahTuntas
    );

    /**
     * Indeks capaian sesuai rumus Excel.
     */
    const indeksCapaian = calculateIndeksCapaian(capaianOtomatis);

    return NextResponse.json({
      ok: true,

      data: {
        /**
         * Nilai manual tetap ada.
         */
        capaian_manual: Number(manualRow.capaian_manual || 0),

        /**
         * Nilai otomatis dari seluruh data.
         */
        capaian_otomatis: capaianOtomatis,

        /**
         * Indeks capaian.
         */
        indeks_capaian: indeksCapaian,

        /**
         * Detail perhitungan.
         */
        saldo,
        belum_tl: belumTL,
        tl_belum_tuntas: tlBelumTuntas,
        tl_sudah_tuntas: tlSudahTuntas,

        updated_at: manualRow.updated_at,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/capaian ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal menghitung capaian keseluruhan.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT
 *
 * Capaian manual tetap bisa disimpan.
 */
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

    /**
     * Tetap pertahankan batas manual 0-100.
     */
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
      message: "Capaian manual berhasil disimpan.",
    });
  } catch (error) {
    console.error("PUT /api/dashboard/capaian ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal menyimpan capaian manual.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
