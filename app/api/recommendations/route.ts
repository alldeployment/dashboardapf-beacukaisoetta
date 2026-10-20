import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * Periode monitoring terpisah dari tanggal LHA/LHP.
 *
 * lha_date      = tanggal asli dokumen.
 * tahun_periode = tahun pengelolaan data dalam aplikasi.
 */
async function ensurePeriodColumn() {
  await pool.query(`
    ALTER TABLE public.recommendations
    ADD COLUMN IF NOT EXISTS tahun_periode INTEGER
  `);
  await pool.query(`
  ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS asal_recommendation_id INTEGER
`);

  await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS recommendations_asal_period_unique_idx
  ON public.recommendations (
    asal_recommendation_id,
    tahun_periode
  )
  WHERE asal_recommendation_id IS NOT NULL
`);

  // Migrasi awal data lama tanpa mengubah tanggal dokumen.
  // Gunakan tahun pembuatan record sebagai periode awal.
  await pool.query(`
    UPDATE public.recommendations
    SET tahun_periode = EXTRACT(YEAR FROM created_at)::INTEGER
    WHERE tahun_periode IS NULL
      AND created_at IS NOT NULL
  `);

  // Cadangan untuk record lama yang tidak memiliki created_at.
  await pool.query(`
    UPDATE public.recommendations
    SET tahun_periode = EXTRACT(YEAR FROM lha_date)::INTEGER
    WHERE tahun_periode IS NULL
      AND lha_date IS NOT NULL
  `);

  // Pastikan record lama yang tidak memiliki tanggal tetap teralokasi.
  await pool.query(
    `
    UPDATE public.recommendations
    SET tahun_periode = $1
    WHERE tahun_periode IS NULL
    `,
    [new Date().getFullYear()]
  );
}

function parseYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const text = String(value);

  if (!/^\d{4}$/.test(text)) return null;

  const year = Number(text);

  if (!Number.isInteger(year) || year < 1900 || year > 9998) {
    return null;
  }

  return year;
}

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
 * Membawa rekomendasi yang belum tuntas ke periode berikutnya.
 * Data periode lama tidak diubah atau dihapus.
 */
async function carryOverUnfinishedRecommendations(targetYear: number) {
  // Periode awal aplikasi adalah 2026.
  // Carry-over mulai berlaku untuk 2027 dan seterusnya.
  if (targetYear <= 2026) return;

  const previousYear = targetYear - 1;

  // Bersihkan carry-over ke periode tujuan jika rekomendasi
  // asal sudah tuntas. Data asli periode sebelumnya tetap aman.
  await pool.query(
    `
    DELETE FROM public.recommendations AS carried
    USING public.recommendations AS previous
    WHERE carried.tahun_periode = $2
      AND previous.tahun_periode = $1
      AND UPPER(TRIM(COALESCE(previous.follow_up_status, '')))
          = 'SUDAH_TUNTAS'
      AND (
        carried.asal_recommendation_id = previous.id
        OR (
          carried.asal_recommendation_id IS NULL
          AND carried.source = previous.source
          AND carried.category = previous.category
          AND carried.lha_number = previous.lha_number
          AND carried.lha_date IS NOT DISTINCT FROM previous.lha_date
          AND carried.recommendation_number
              IS NOT DISTINCT FROM previous.recommendation_number
        )
      )
    `,
    [previousYear, targetYear]
  );

  await pool.query(
    `
    INSERT INTO public.recommendations (
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
      saldo_status,
      capaian,
      asal_recommendation_id
    )
    SELECT
      previous.source,
      previous.category,
      previous.lha_number,
      previous.lha_date,
      $2,
      previous.recommendation_number,
      previous.recommendation_count,
      previous.temuan,
      previous.recommendation,
      previous.description,
      previous.keterangan_1,
      previous.keterangan_2,
      previous.keterangan_3,
      previous.no_temuan,
      previous.judul,
      previous.rencana_aksi,
      previous.keterangan_bukti_dukung,
      previous.waktu_pelaksanaan,
      previous.uic,
      previous.tindak_lanjut,
      CASE
        WHEN previous.follow_up_status = 'BELUM_TUNTAS'
          THEN 'SUDAH_TL'
        ELSE previous.follow_up_status
      END,
      previous.saldo_status,
      CASE
        WHEN previous.follow_up_status IN ('SUDAH_TL', 'BELUM_TUNTAS')
          THEN 50
        ELSE 0
      END,
      previous.id
    FROM public.recommendations AS previous
    WHERE previous.tahun_periode = $1
      AND previous.follow_up_status IN (
        'BELUM_TL',
        'SUDAH_TL',
        'BELUM_TUNTAS'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.recommendations AS current
        WHERE current.asal_recommendation_id = previous.id
          AND current.tahun_periode = $2
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.recommendations AS current
        WHERE current.tahun_periode = $2
          AND current.source = previous.source
          AND current.category = previous.category
          AND current.lha_number = previous.lha_number
          AND current.recommendation_number
              IS NOT DISTINCT FROM previous.recommendation_number
          AND current.asal_recommendation_id IS NULL
      )
    ON CONFLICT DO NOTHING
    `,
    [previousYear, targetYear]
  );

  // Hitung ulang jumlah rekomendasi per folder pada periode tujuan.
  await pool.query(
    `
    UPDATE public.recommendations AS target
    SET recommendation_count = counts.total
    FROM (
      SELECT
        source,
        category,
        lha_number,
        tahun_periode,
        COUNT(*)::int AS total
      FROM public.recommendations
      WHERE tahun_periode = $1
      GROUP BY source, category, lha_number, tahun_periode
    ) AS counts
    WHERE target.tahun_periode = counts.tahun_periode
      AND target.source = counts.source
      AND target.category = counts.category
      AND target.lha_number = counts.lha_number
    `,
    [targetYear]
  );
}

/**
 * GET
 * Membaca rekomendasi sesuai tahun periode yang dipilih.
 */
export async function GET(request: NextRequest) {
  try {
    await ensurePeriodColumn();

    const { searchParams } = new URL(request.url);

    const lhaNumber = searchParams.get("lhaNumber");
    const source = searchParams.get("source");
    const yearParam = searchParams.get("year");

    const values: (string | number)[] = [];
    const conditions: string[] = [];

    if (yearParam !== null) {
      const year = parseYear(yearParam);

      if (year === null) {
        return NextResponse.json(
          {
            ok: false,
            message: "Tahun periode tidak valid.",
          },
          { status: 400 }
        );
      }

      await carryOverUnfinishedRecommendations(year);

      values.push(year);
      conditions.push(`tahun_periode = $${values.length}`);
    }
    // Jangan tampilkan carry-over jika sumber periode sebelumnya
    // sudah berstatus tuntas.
    if (yearParam !== null && Number(yearParam) > 2026) {
      values.push(Number(yearParam) - 1);
      const previousYearPlaceholder = `$${values.length}`;

      conditions.push(`
          NOT EXISTS (
            SELECT 1
            FROM public.recommendations previous
            WHERE previous.tahun_periode = ${previousYearPlaceholder}
              AND UPPER(TRIM(COALESCE(previous.follow_up_status, '')))
                  = 'SUDAH_TUNTAS'
              AND (
                current_rec.asal_recommendation_id = previous.id
                OR (
                  current_rec.asal_recommendation_id IS NULL
                  AND current_rec.source = previous.source
                  AND current_rec.category = previous.category
                  AND current_rec.lha_number = previous.lha_number
                  AND current_rec.lha_date
                      IS NOT DISTINCT FROM previous.lha_date
                  AND current_rec.recommendation_number
                      IS NOT DISTINCT FROM previous.recommendation_number
                )
              )
          )
        `);
    }
    if (lhaNumber) {
      values.push(lhaNumber);
      conditions.push(`lha_number = $${values.length}`);
    }

    if (source) {
      values.push(source);
      conditions.push(`source = $${values.length}`);
    }

    let query = `
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
        saldo_status,
        capaian,
        created_at,
        updated_at
        FROM public.recommendations AS current_rec
    `;

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
 * Menambahkan satu atau beberapa rekomendasi.
 *
 * Periode dapat dikirim melalui:
 * body.tahun_periode, body.year, atau query ?year=2026.
 * Jika tidak dikirim, tahun berjalan digunakan.
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    await ensurePeriodColumn();

    const body = await request.json();
    const { searchParams } = new URL(request.url);

    const requestedYear =
      body.tahun_periode ?? body.year ?? searchParams.get("year");

    const tahunPeriode =
      requestedYear === null || requestedYear === undefined
        ? new Date().getFullYear()
        : parseYear(requestedYear);

    if (tahunPeriode === null) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tahun periode tidak valid.",
        },
        { status: 400 }
      );
    }

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

    // Tetap mendukung format request lama.
    if (!Array.isArray(recommendationList)) {
      recommendationList = [
        {
          temuan: body.temuan || "",
          recommendation: body.recommendation || "",
          keterangan_1: body.keterangan_1 || "",
          keterangan_2: body.keterangan_2 || "",
          keterangan_3: body.keterangan_3 || "",
          no_temuan: body.no_temuan || "",
          judul: body.judul || "",
          rencana_aksi: body.rencana_aksi || "",
          keterangan_bukti_dukung: body.keterangan_bukti_dukung || "",
          waktu_pelaksanaan: body.waktu_pelaksanaan || null,
          uic: body.uic || "",
          tindak_lanjut: body.tindak_lanjut || "",
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

    // Nomor rekomendasi dihitung per LHA dan periode.
    const lastNumberResult = await client.query(
      `
      SELECT
        COALESCE(MAX(recommendation_number), 0)::int
          AS last_number
      FROM recommendations
      WHERE lha_number = $1
        AND source = $2
        AND category = $3
        AND tahun_periode = $4
      `,
      [lhaNumber, source, category, tahunPeriode]
    );

    let nextNumber = Number(lastNumberResult.rows[0]?.last_number || 0) + 1;

    const insertedRows = [];

    for (const item of recommendationList) {
      const capaian = calculateCapaian(item.followUpStatus);

      const result = await client.query(
        `
        INSERT INTO recommendations (
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
          saldo_status,
          capaian
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23
        )
        RETURNING *
        `,
        [
          source,
          category,
          lhaNumber,
          lhaDate,
          tahunPeriode,
          nextNumber,
          recommendationList.length,
          item.temuan || "",
          item.recommendation || "",
          item.description || "",
          item.keterangan_1 || "",
          item.keterangan_2 || "",
          item.keterangan_3 || "",
          item.no_temuan || "",
          item.judul || "",
          item.rencana_aksi || "",
          item.keterangan_bukti_dukung || "",
          item.waktu_pelaksanaan || null,
          item.uic || "",
          item.tindak_lanjut || "",
          item.followUpStatus,
          item.saldoStatus,
          capaian,
        ]
      );

      insertedRows.push(result.rows[0]);
      nextNumber++;
    }

    // Hitung jumlah rekomendasi hanya dalam LHA dan periode yang sama.
    await client.query(
      `
      UPDATE recommendations
      SET
        recommendation_count = (
          SELECT COUNT(*)
          FROM recommendations r
          WHERE r.lha_number = recommendations.lha_number
            AND r.source = recommendations.source
            AND r.category = recommendations.category
            AND r.tahun_periode = recommendations.tahun_periode
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE lha_number = $1
        AND source = $2
        AND category = $3
        AND tahun_periode = $4
      `,
      [lhaNumber, source, category, tahunPeriode]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        ok: true,
        year: tahunPeriode,
        message: `${insertedRows.length} rekomendasi berhasil ditambahkan ke periode ${tahunPeriode}.`,
        data: insertedRows,
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

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
 * Memperbarui rekomendasi dan mempertahankan periode
 * jika tahun_periode tidak dikirim.
 */
export async function PUT(request: NextRequest) {
  try {
    await ensurePeriodColumn();

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
      no_temuan,
      judul,
      rencana_aksi,
      keterangan_bukti_dukung,
      waktu_pelaksanaan,
      uic,
      tindak_lanjut,
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

    let tahunPeriode: number | null = null;

    if (body.tahun_periode !== undefined && body.tahun_periode !== null) {
      tahunPeriode = parseYear(body.tahun_periode);

      if (tahunPeriode === null) {
        return NextResponse.json(
          {
            ok: false,
            message: "Tahun periode tidak valid.",
          },
          { status: 400 }
        );
      }
    }

    const capaian = calculateCapaian(followUpStatus);

    const result = await pool.query(
      `
      UPDATE recommendations
      SET
        source = $1,
        category = $2,
        lha_number = $3,
        lha_date = $4,
        tahun_periode = COALESCE($5, tahun_periode),
        recommendation_number = COALESCE($6, recommendation_number),
        temuan = $7,
        recommendation = $8,
        description = $9,
        keterangan_1 = $10,
        keterangan_2 = $11,
        keterangan_3 = $12,
        no_temuan = $13,
        judul = $14,
        rencana_aksi = $15,
        keterangan_bukti_dukung = $16,
        waktu_pelaksanaan = $17,
        uic = $18,
        tindak_lanjut = $19,
        follow_up_status = $20,
        saldo_status = $21,
        capaian = $22,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $23
      RETURNING *
      `,
      [
        source,
        category,
        lhaNumber,
        lhaDate,
        tahunPeriode,
        recommendationNumber || null,
        temuan || "",
        recommendation || "",
        description || "",
        keterangan_1 || "",
        keterangan_2 || "",
        keterangan_3 || "",
        no_temuan || "",
        judul || "",
        rencana_aksi || "",
        keterangan_bukti_dukung || "",
        waktu_pelaksanaan || null,
        uic || "",
        tindak_lanjut || "",
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
 * Menghapus satu rekomendasi.
 */
export async function DELETE(request: NextRequest) {
  try {
    await ensurePeriodColumn();

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

    const deleted = result.rows[0];

    // Hitung ulang jumlah hanya untuk periode yang sama.
    await pool.query(
      `
      UPDATE recommendations
      SET
        recommendation_count = (
          SELECT COUNT(*)
          FROM recommendations r
          WHERE r.lha_number = recommendations.lha_number
            AND r.source = recommendations.source
            AND r.category = recommendations.category
            AND r.tahun_periode = recommendations.tahun_periode
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE lha_number = $1
        AND source = $2
        AND category = $3
        AND tahun_periode = $4
      `,
      [
        deleted.lha_number,
        deleted.source,
        deleted.category,
        deleted.tahun_periode,
      ]
    );

    return NextResponse.json({
      ok: true,
      message: "Rekomendasi berhasil dihapus.",
      data: deleted,
    });
  } catch (error) {
    console.error("DELETE RECOMMENDATIONS ERROR:", error);

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
