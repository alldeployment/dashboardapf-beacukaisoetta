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
/**
 * Menyimpan pilihan triwulan awal untuk setiap folder LHA/LHP.
 * Pilihan ini berlaku untuk seluruh rekomendasi dalam folder.
 */

async function ensureRecommendationFolderQuarterTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recommendation_folder_quarter (
      id BIGSERIAL PRIMARY KEY,
      source VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      lha_number TEXT NOT NULL,
      tahun_periode INTEGER NOT NULL,

      triwulan SMALLINT
        CHECK (triwulan BETWEEN 1 AND 4),

      triwulan_aktif SMALLINT
        CHECK (triwulan_aktif BETWEEN 1 AND 4),

      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT recommendation_folder_quarter_unique
        UNIQUE (source, category, lha_number, tahun_periode)
    )
  `);

  // Pastikan kolom tersedia pada database lama.
  await pool.query(`
    ALTER TABLE public.recommendation_folder_quarter
    ADD COLUMN IF NOT EXISTS triwulan_aktif SMALLINT
  `);

  // Izinkan triwulan kosong sampai admin menentukan.
  await pool.query(`
    ALTER TABLE public.recommendation_folder_quarter
    ALTER COLUMN triwulan DROP NOT NULL
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_folder_quarter
    ALTER COLUMN triwulan_aktif DROP NOT NULL
  `);

  // Tidak ada backfill otomatis.
  // Tidak menetapkan TW1 untuk folder lama.
  // Tidak mengubah pilihan triwulan yang sudah tersimpan.
}

/**
 * Menyimpan riwayat status rekomendasi per triwulan.
 * Setiap triwulan memiliki catatan sendiri agar
 * perubahan status triwulan berikutnya tidak menimpa sebelumnya.
 */
async function ensureQuarterHistoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recommendation_quarter_history (
      id BIGSERIAL PRIMARY KEY,
      recommendation_id INTEGER NOT NULL
        REFERENCES public.recommendations(id)
        ON DELETE CASCADE,
      tahun_periode INTEGER NOT NULL,
      triwulan SMALLINT NOT NULL
        CHECK (triwulan BETWEEN 1 AND 4),
      follow_up_status VARCHAR(50) NOT NULL,
      saldo_status VARCHAR(50) NOT NULL,
      capaian NUMERIC(5, 2) NOT NULL DEFAULT 0,
is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT recommendation_quarter_history_unique
        UNIQUE (recommendation_id, tahun_periode, triwulan)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS recommendation_quarter_history_period_idx
    ON public.recommendation_quarter_history (
      tahun_periode,
      triwulan
    )
  `);
  await pool.query(`
  ALTER TABLE public.recommendation_quarter_history
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT FALSE
`);
  // Menandai apakah riwayat bawaan masih aktif.
  await pool.query(`
    ALTER TABLE public.recommendation_quarter_history
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
  `);
  // Menandai asal riwayat rekomendasi bawaan dari triwulan sebelumnya.
  await pool.query(`
    ALTER TABLE public.recommendation_quarter_history
    ADD COLUMN IF NOT EXISTS carry_forward_from_year INTEGER
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_quarter_history
    ADD COLUMN IF NOT EXISTS carry_forward_from_quarter SMALLINT
  `);
  await pool.query(`
  ALTER TABLE public.recommendation_quarter_history
    ADD COLUMN IF NOT EXISTS is_folder_fallback
      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS folder_fallback_applied_at
      TIMESTAMPTZ
`);
}

async function ensureRecommendationSnapshotTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.dashboard_capaian_triwulan (
      id BIGSERIAL PRIMARY KEY,
      tahun INTEGER NOT NULL,
      triwulan SMALLINT NOT NULL CHECK (triwulan BETWEEN 1 AND 4),
      total_masuk_saldo INTEGER NOT NULL DEFAULT 0,
      belum_tl INTEGER NOT NULL DEFAULT 0,
      tl_belum_tuntas INTEGER NOT NULL DEFAULT 0,
      tl_sudah_tuntas INTEGER NOT NULL DEFAULT 0,
      capaian_dasar NUMERIC NOT NULL DEFAULT 0,
      capaian_persen NUMERIC NOT NULL DEFAULT 0,
      rumus_digunakan TEXT NOT NULL,
      rumus_dasar_digunakan TEXT NOT NULL DEFAULT
        '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo',
      is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
      finalized_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT dashboard_capaian_triwulan_unique UNIQUE (tahun, triwulan)
    )
  `);

  await pool.query(`
    ALTER TABLE public.dashboard_capaian_triwulan
    ADD COLUMN IF NOT EXISTS rumus_dasar_digunakan TEXT NOT NULL DEFAULT
      '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo'
  `);
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
 * GET
 * Membaca rekomendasi berdasarkan tahun dan triwulan yang dipilih.
 * Jika triwulan tidak dikirim, gunakan triwulan aktif folder.
 */
export async function GET(request: NextRequest) {
  try {
    await ensurePeriodColumn();
    await ensureQuarterHistoryTable();
    await ensureRecommendationFolderQuarterTable();
    await ensureRecommendationSnapshotTable();

    const { searchParams } = new URL(request.url);

    const lhaNumber = searchParams.get("lhaNumber");
    const source = searchParams.get("source");
    const yearParam = searchParams.get("year");
    const triwulanParam = searchParams.get("triwulan");

    let selectedTriwulan: number | null = null;

    if (triwulanParam !== null && triwulanParam !== "") {
      selectedTriwulan = Number(triwulanParam);

      if (
        !Number.isInteger(selectedTriwulan) ||
        ![1, 2, 3, 4].includes(selectedTriwulan)
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "Triwulan harus bernilai 1 sampai 4.",
          },
          { status: 400 }
        );
      }
    }

    const selectedYear = yearParam !== null ? parseYear(yearParam) : null;

    if (yearParam !== null && selectedYear === null) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tahun periode tidak valid.",
        },
        { status: 400 }
      );
    }

    // $1 = triwulan yang dipilih
    // $2 = tahun periode yang dipilih
    const values: (string | number | null)[] = [selectedTriwulan, selectedYear];

    const conditions: string[] = [];

    if (lhaNumber) {
      values.push(lhaNumber);
      conditions.push(`current_rec.lha_number = $${values.length}`);
    }

    if (source) {
      values.push(source);
      conditions.push(`current_rec.source = $${values.length}`);
    }

    // Selalu gunakan rekomendasi asli agar tidak terjadi duplikasi.
    conditions.push(`
  current_rec.asal_recommendation_id IS NULL
`);

    // Filter berdasarkan tahun pengelolaan rekomendasi.
    if (selectedYear !== null) {
      conditions.push("current_rec.tahun_periode = $2::INTEGER");
    }

    // Jika memilih triwulan:
    // - Gunakan riwayat individu jika tersedia.
    // - Jika belum memiliki riwayat, gunakan triwulan aktif folder.
    // - Jangan menimpa riwayat individu dengan triwulan folder.
    if (selectedTriwulan !== null) {
      conditions.push(`
        (
          quarter_history.triwulan = $1::SMALLINT
          OR (
            NOT EXISTS (
              SELECT 1
              FROM public.recommendation_quarter_history existing_history
              WHERE existing_history.recommendation_id = current_rec.id
                AND existing_history.tahun_periode = COALESCE(
                  $2::INTEGER,
                  current_rec.tahun_periode
                )
                AND existing_history.is_active = TRUE
            )
            AND folder_quarter.triwulan_aktif = $1::SMALLINT
          )
        )
      `);
    }
    let query = `
    SELECT
      current_rec.id,
      current_rec.source,
      current_rec.category,
      current_rec.lha_number,
      current_rec.lha_date,
      current_rec.tahun_periode AS tahun_periode_asal,
      folder_quarter.triwulan AS folder_triwulan,
folder_quarter.triwulan_aktif AS folder_triwulan_aktif,
quarter_history.tahun_periode AS tahun_riwayat,
current_rec.recommendation_number,
      current_rec.recommendation_count,
      current_rec.temuan,
      current_rec.recommendation,
      current_rec.description,
      current_rec.keterangan_1,
      current_rec.keterangan_2,
      current_rec.keterangan_3,
      current_rec.no_temuan,
      current_rec.judul,
      current_rec.rencana_aksi,
      current_rec.keterangan_bukti_dukung,
      current_rec.waktu_pelaksanaan,
      current_rec.uic,
      current_rec.tindak_lanjut,

      COALESCE(
        quarter_history.follow_up_status,
        current_rec.follow_up_status
      ) AS follow_up_status,

      COALESCE(
        quarter_history.saldo_status,
        current_rec.saldo_status
      ) AS saldo_status,

      COALESCE(
        quarter_history.capaian,
        current_rec.capaian
      ) AS capaian,

      quarter_history.triwulan AS triwulan,

      current_rec.created_at,
      current_rec.updated_at

    FROM public.recommendations AS current_rec

    LEFT JOIN public.recommendation_folder_quarter AS folder_quarter
  ON folder_quarter.source = current_rec.source
  AND folder_quarter.category = current_rec.category
  AND folder_quarter.lha_number = current_rec.lha_number
  AND folder_quarter.tahun_periode = COALESCE(
    $2::INTEGER,
    current_rec.tahun_periode
  )

      LEFT JOIN LATERAL (
        SELECT
          h.id,
          h.tahun_periode,
          h.triwulan,
          h.follow_up_status,
          h.saldo_status,
          h.capaian
        FROM public.recommendation_quarter_history h
        WHERE h.recommendation_id = current_rec.id
          AND h.is_active = TRUE
          AND h.tahun_periode = COALESCE(
            $2::INTEGER,
            current_rec.tahun_periode
          )
          AND (
            $1::SMALLINT IS NULL
            OR h.triwulan = $1::SMALLINT
          )
          ORDER BY
          h.updated_at DESC,
          h.id DESC
        LIMIT 1
      ) AS quarter_history ON TRUE

    
  `;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += `
    ORDER BY
      current_rec.lha_number ASC,
      current_rec.recommendation_number ASC NULLS LAST,
      current_rec.created_at ASC
  `;

    const result = await pool.query(query, values);

    const data = result.rows.map((row) => ({
      ...row,
      capaian: Number(row.capaian ?? calculateCapaian(row.follow_up_status)),
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
    await ensureQuarterHistoryTable();
    await ensureRecommendationFolderQuarterTable();
    await ensureRecommendationSnapshotTable();

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
          triwulan: body.triwulan,
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
    const folderQuarter = Number(body.triwulan);

    if (
      !Number.isInteger(folderQuarter) ||
      ![1, 2, 3, 4].includes(folderQuarter)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Triwulan folder LHP wajib dipilih dari 1 sampai 4.",
        },
        { status: 400 }
      );
    }

    const allowedFollowUp = ["BELUM_TL", "SUDAH_TL", "SUDAH_TUNTAS"];

    const allowedSaldo = ["MASUK_SALDO", "BELUM_SALDO", "TIDAK_RELEVAN"];

    for (let i = 0; i < recommendationList.length; i++) {
      const item = recommendationList[i];
      const itemQuarter =
        item.triwulan === null ||
        item.triwulan === undefined ||
        item.triwulan === ""
          ? folderQuarter
          : Number(item.triwulan);

      if (
        !Number.isInteger(itemQuarter) ||
        ![1, 2, 3, 4].includes(itemQuarter)
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: `Pilihan triwulan rekomendasi ke-${i + 1} tidak valid.`,
          },
          { status: 400 }
        );
      }

      // Jika tidak dipilih, rekomendasi mengikuti triwulan folder.
      item.triwulan = itemQuarter;

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

      const insertedRecommendation = result.rows[0];

      insertedRows.push(insertedRecommendation);

      await client.query(
        `
        INSERT INTO public.recommendation_quarter_history (
          recommendation_id,
          tahun_periode,
          triwulan,
          follow_up_status,
          saldo_status,
          capaian
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (recommendation_id, tahun_periode, triwulan)
        DO NOTHING
        RETURNING id
        `,
        [
          insertedRecommendation.id,
          tahunPeriode,
          item.triwulan,
          item.followUpStatus,
          item.saldoStatus,
          capaian,
        ]
      );

      nextNumber++;
    }
    // Simpan triwulan awal untuk folder LHA/LHP.
    // Jika folder sudah ada, jangan menimpa pilihan yang tersimpan.
    await client.query(
      `
  INSERT INTO public.recommendation_folder_quarter (
    source,
    category,
    lha_number,
    tahun_periode,
    triwulan,
    triwulan_aktif
  )
  VALUES ($1, $2, $3, $4, $5, $5)
  ON CONFLICT (
    source,
    category,
    lha_number,
    tahun_periode
  )
  DO NOTHING
  `,
      [source, category, lhaNumber, tahunPeriode, folderQuarter]
    );

    // Hitung jumlah rekomendasi asli dalam LHA dan periode yang sama.
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
            AND r.asal_recommendation_id IS NULL
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE lha_number = $1
        AND source = $2
        AND category = $3
        AND tahun_periode = $4
        AND asal_recommendation_id IS NULL
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
  const client = await pool.connect();

  try {
    await ensurePeriodColumn();
    await ensureQuarterHistoryTable();
    await ensureRecommendationSnapshotTable();

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
        { ok: false, message: "ID rekomendasi wajib diisi." },
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
        { ok: false, message: "Status tindak lanjut tidak valid." },
        { status: 400 }
      );
    }

    if (!allowedSaldo.includes(saldoStatus)) {
      return NextResponse.json(
        { ok: false, message: "Status saldo tidak valid." },
        { status: 400 }
      );
    }

    let tahunPeriode: number | null = null;

    if (body.tahun_periode !== undefined && body.tahun_periode !== null) {
      tahunPeriode = parseYear(body.tahun_periode);

      if (tahunPeriode === null) {
        return NextResponse.json(
          { ok: false, message: "Tahun periode tidak valid." },
          { status: 400 }
        );
      }
    }

    const capaian = calculateCapaian(followUpStatus);

    await client.query("BEGIN");

    // 1. Ambil rekomendasi yang sedang diedit.
    const currentResult = await client.query(
      `
      SELECT *
      FROM public.recommendations
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { ok: false, message: "Data rekomendasi tidak ditemukan." },
        { status: 404 }
      );
    }

    const currentRecommendation = currentResult.rows[0];
    // Identifikasi apakah rekomendasi ini merupakan rekomendasi bawaan.

    // Tahun asli rekomendasi, tidak boleh berubah.
    const tahunPeriodeAsal = Number(currentRecommendation.tahun_periode);

    // Tahun riwayat yang sedang diedit.
    const tahunRiwayat =
      body.tahun_riwayat !== undefined && body.tahun_riwayat !== null
        ? parseYear(body.tahun_riwayat)
        : tahunPeriodeAsal;

    if (tahunRiwayat === null) {
      throw new Error("Tahun riwayat tidak valid.");
    }
    // Tahun yang digunakan untuk membaca dan mengubah riwayat.
    const effectiveYear = tahunRiwayat;
    const requestedQuarter =
      body.triwulan_riwayat !== undefined && body.triwulan_riwayat !== null
        ? Number(body.triwulan_riwayat)
        : null;

    if (
      requestedQuarter !== null &&
      (!Number.isInteger(requestedQuarter) ||
        ![1, 2, 3, 4].includes(requestedQuarter))
    ) {
      throw new Error("Triwulan riwayat tidak valid.");
    }

    // Identitas folder tidak boleh berubah ketika mengedit
    // satu rekomendasi. Periode dan folder memiliki pengaturan sendiri.
    const folderIdentityChanged =
      String(source) !== String(currentRecommendation.source) ||
      String(category) !== String(currentRecommendation.category) ||
      String(lhaNumber) !== String(currentRecommendation.lha_number);
    if (folderIdentityChanged) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          ok: false,
          message:
            "Sumber, kategori, nomor LHA/LHP, dan tahun periode tidak dapat diubah melalui edit satu rekomendasi.",
        },
        { status: 409 }
      );
    }

    // 2. Ambil seluruh riwayat aktif rekomendasi ini.
    const activeHistoryResult = await client.query(
      `
      SELECT *
      FROM public.recommendation_quarter_history
      WHERE recommendation_id = $1
        AND tahun_periode = $2
        AND is_active = TRUE
        AND ($3::int IS NULL OR triwulan = $3)
        ORDER BY updated_at DESC, id DESC
        FOR UPDATE
      `,
      [id, effectiveYear, requestedQuarter]
    );

    const activeHistories = activeHistoryResult.rows;
    const previousHistory = activeHistories[0] ?? null;

    // Cek apakah triwulan asal sudah difinalisasi.
    if (previousHistory) {
      const oldFinalizedResult = await client.query(
        `
    SELECT 1
    FROM public.dashboard_capaian_triwulan
    WHERE tahun = $1
      AND triwulan = $2
      AND is_finalized = TRUE
    LIMIT 1
    `,
        [effectiveYear, previousHistory.triwulan]
      );

      if (oldFinalizedResult.rows.length > 0) {
        throw new Error(
          "Triwulan sebelumnya sudah difinalisasi dan tidak dapat dipindahkan."
        );
      }
    }

    // Pertahankan triwulan aktif sebelumnya.
    // Edit status tidak memindahkan rekomendasi ke triwulan lain.
    if (previousHistory) {
      await client.query(
        `
    UPDATE public.recommendation_quarter_history
    SET
      follow_up_status = $1,
      saldo_status = $2,
      capaian = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    `,
        [followUpStatus, saldoStatus, capaian, previousHistory.id]
      );
    }

    const activeQuarter = previousHistory?.triwulan ?? null;
    const updateResult = await client.query(
      `
      UPDATE public.recommendations
      SET
        lha_date = $1,
        recommendation_number = COALESCE($2, recommendation_number),
        temuan = $3,
        recommendation = $4,
        description = $5,
        keterangan_1 = $6,
        keterangan_2 = $7,
        keterangan_3 = $8,
        no_temuan = $9,
        judul = $10,
        rencana_aksi = $11,
        keterangan_bukti_dukung = $12,
        waktu_pelaksanaan = $13,
        uic = $14,
        tindak_lanjut = $15,
        follow_up_status = CASE
        WHEN tahun_periode = $20 THEN $16
        ELSE follow_up_status
      END,
      saldo_status = CASE
        WHEN tahun_periode = $20 THEN $17
        ELSE saldo_status
      END,
      capaian = CASE
        WHEN tahun_periode = $20 THEN $18
        ELSE capaian
      END,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
      RETURNING *
      `,
      [
        lhaDate,
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
        tahunPeriodeAsal,
      ]
    );

    if (updateResult.rows.length === 0) {
      throw new Error("Gagal memperbarui rekomendasi.");
    }

    const updatedRecommendation = updateResult.rows[0];

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      message: "Rekomendasi berhasil diperbarui.",
      data: updatedRecommendation,
      triwulanAktif: activeQuarter,
      triwulanBerikutnya: null,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK PUT ERROR:", rollbackError);
    }

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
  } finally {
    client.release();
  }
}

/**
 * PATCH
 * Mengoreksi triwulan seluruh rekomendasi dalam satu folder LHA/LHP.
 * Status rekomendasi tetap dipertahankan.
 */

export async function PATCH(request: NextRequest) {
  const client = await pool.connect();

  try {
    await ensurePeriodColumn();
    await ensureQuarterHistoryTable();
    await ensureRecommendationSnapshotTable();
    await ensureRecommendationFolderQuarterTable();

    const body = await request.json();
    // PATCH khusus untuk mengubah triwulan folder LHA/LHP.

    if (body.scope === "folder") {
      const source = body.source;
      const category = body.category;
      const lhaNumber = body.lha_number;
      const tahunPeriode = parseYear(body.tahun_periode ?? body.year);
      const targetQuarter = Number(body.triwulan);

      if (!source || !category || !lhaNumber || tahunPeriode === null) {
        return NextResponse.json(
          {
            ok: false,
            message: "Identitas folder dan tahun periode wajib diisi.",
          },
          { status: 400 }
        );
      }

      if (
        !Number.isInteger(targetQuarter) ||
        ![1, 2, 3, 4].includes(targetQuarter)
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "Triwulan folder harus bernilai 1 sampai 4.",
          },
          { status: 400 }
        );
      }

      await client.query("BEGIN");

      // 1. Kunci seluruh rekomendasi dalam folder.
      const folderResult = await client.query(
        `
        SELECT
          id,
          follow_up_status,
          saldo_status,
          capaian
        FROM public.recommendations
        WHERE source = $1
          AND category = $2
          AND lha_number = $3
          AND tahun_periode = $4
          AND asal_recommendation_id IS NULL
        ORDER BY id
        FOR UPDATE
        `,
        [source, category, lhaNumber, tahunPeriode]
      );

      if (folderResult.rows.length === 0) {
        throw new Error("Folder LHP/LHA tidak ditemukan.");
      }

      // 2. Jangan mengubah riwayat yang sudah difinalisasi.
      const finalizedSourceResult = await client.query(
        `
        SELECT DISTINCT h.triwulan
        FROM public.recommendations r
        INNER JOIN public.recommendation_quarter_history h
          ON h.recommendation_id = r.id
        LEFT JOIN public.dashboard_capaian_triwulan s
          ON s.tahun = h.tahun_periode
          AND s.triwulan = h.triwulan
        WHERE r.source = $1
          AND r.category = $2
          AND r.lha_number = $3
          AND r.tahun_periode = $4
          AND r.asal_recommendation_id IS NULL
          AND h.is_active = TRUE
          AND (
            h.is_finalized = TRUE
            OR s.is_finalized = TRUE
          )
        ORDER BY h.triwulan
        `,
        [source, category, lhaNumber, tahunPeriode]
      );

      if (finalizedSourceResult.rows.length > 0) {
        const quarters = finalizedSourceResult.rows
          .map((item) => `TW${item.triwulan}`)
          .join(", ");

        throw new Error(
          `Folder memiliki riwayat yang sudah difinalisasi (${quarters}). Batalkan finalisasi terkait terlebih dahulu.`
        );
      }

      // 3. Pastikan triwulan tujuan belum difinalisasi.
      const targetSnapshotResult = await client.query(
        `
        SELECT 1
        FROM public.dashboard_capaian_triwulan
        WHERE tahun = $1
          AND triwulan = $2
          AND is_finalized = TRUE
        LIMIT 1
        `,
        [tahunPeriode, targetQuarter]
      );

      if (targetSnapshotResult.rows.length > 0) {
        throw new Error(
          `TW${targetQuarter} sudah difinalisasi dan belum dapat menerima rekomendasi.`
        );
      }

      let movedRecommendations = 0;

      // 4. Pindahkan setiap rekomendasi dalam folder.
      for (const recommendation of folderResult.rows) {
        const currentHistoryResult = await client.query(
          `
          SELECT *
          FROM public.recommendation_quarter_history
          WHERE recommendation_id = $1
            AND tahun_periode = $2
            AND is_active = TRUE
          ORDER BY
            updated_at DESC,
            triwulan DESC,
            id DESC
          LIMIT 1
          FOR UPDATE
          `,
          [recommendation.id, tahunPeriode]
        );

        const currentHistory = currentHistoryResult.rows[0] ?? null;

        // Pertahankan status terakhir.
        const followUpStatus =
          currentHistory?.follow_up_status ??
          recommendation.follow_up_status ??
          "BELUM_TL";

        const saldoStatus =
          currentHistory?.saldo_status ??
          recommendation.saldo_status ??
          "BELUM_SALDO";

        const capaian = Number(
          currentHistory?.capaian ??
            recommendation.capaian ??
            calculateCapaian(followUpStatus)
        );

        // Periksa riwayat tujuan.
        const targetHistoryResult = await client.query(
          `
          SELECT id, is_finalized
          FROM public.recommendation_quarter_history
          WHERE recommendation_id = $1
            AND tahun_periode = $2
            AND triwulan = $3
          FOR UPDATE
          `,
          [recommendation.id, tahunPeriode, targetQuarter]
        );

        const targetHistory = targetHistoryResult.rows[0] ?? null;

        if (targetHistory?.is_finalized === true) {
          throw new Error(
            `Rekomendasi ID ${recommendation.id} memiliki riwayat TW${targetQuarter} yang sudah difinalisasi.`
          );
        }

        // Nonaktifkan riwayat aktif sebelumnya.
        // Data lama tetap tersimpan dan tidak dihapus.
        await client.query(
          `
          UPDATE public.recommendation_quarter_history
          SET
            is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
          WHERE recommendation_id = $1
            AND tahun_periode = $2
            AND is_active = TRUE
            AND is_finalized = FALSE
          `,
          [recommendation.id, tahunPeriode]
        );

        // Buat atau aktifkan riwayat di triwulan tujuan.
        await client.query(
          `
          INSERT INTO public.recommendation_quarter_history (
            recommendation_id,
            tahun_periode,
            triwulan,
            follow_up_status,
            saldo_status,
            capaian,
            is_active,
            is_finalized,
            is_folder_fallback,
            folder_fallback_applied_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE, FALSE, NULL)
    
          ON CONFLICT (
            recommendation_id,
            tahun_periode,
            triwulan
          )
          DO UPDATE SET
            follow_up_status = EXCLUDED.follow_up_status,
            saldo_status = EXCLUDED.saldo_status,
            capaian = EXCLUDED.capaian,
            is_active = TRUE,
            is_finalized = FALSE,
            is_folder_fallback = FALSE,
            folder_fallback_applied_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE public.recommendation_quarter_history.is_finalized = FALSE
          `,
          [
            recommendation.id,
            tahunPeriode,
            targetQuarter,
            followUpStatus,
            saldoStatus,
            Number.isFinite(capaian) ? capaian : 0,
          ]
        );

        movedRecommendations++;
      }

      // 5. Simpan posisi folder yang baru.
      await client.query(
        `
        INSERT INTO public.recommendation_folder_quarter (
          source,
          category,
          lha_number,
          tahun_periode,
          triwulan,
          triwulan_aktif
        )
        VALUES ($1, $2, $3, $4, $5, $5)
    
        ON CONFLICT (
          source,
          category,
          lha_number,
          tahun_periode
        )
        DO UPDATE SET
          triwulan = EXCLUDED.triwulan,
          triwulan_aktif = EXCLUDED.triwulan_aktif,
          updated_at = CURRENT_TIMESTAMP
        `,
        [source, category, lhaNumber, tahunPeriode, targetQuarter]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        ok: true,
        message: `Folder berhasil dipindahkan ke TW${targetQuarter}. Seluruh rekomendasi dalam folder ikut dipindahkan.`,
        data: {
          source,
          category,
          lha_number: lhaNumber,
          tahun_periode: tahunPeriode,
          folder_triwulan: targetQuarter,
          folder_triwulan_aktif: targetQuarter,
          jumlah_rekomendasi_dipindahkan: movedRecommendations,
        },
      });
    }

    const id = Number(body.id);
    const tahunPeriode = parseYear(body.tahun_periode ?? body.year);
    const targetQuarter = Number(body.triwulan);

    if (!Number.isInteger(id) || id <= 0 || tahunPeriode === null) {
      return NextResponse.json(
        {
          ok: false,
          message: "ID rekomendasi dan tahun periode wajib diisi dengan benar.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(targetQuarter) ||
      ![1, 2, 3, 4].includes(targetQuarter)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Triwulan harus bernilai 1 sampai 4.",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 1. Ambil rekomendasi asli.
    const recommendationResult = await client.query(
      `
  SELECT r.*
  FROM public.recommendations r
  WHERE r.id = $1
    AND r.asal_recommendation_id IS NULL
  FOR UPDATE OF r
  `,
      [id]
    );

    if (recommendationResult.rows.length === 0) {
      throw new Error("Rekomendasi tidak ditemukan.");
    }

    const recommendation = recommendationResult.rows[0];

    // 2. Ambil seluruh riwayat aktif rekomendasi ini.
    const activeHistoryResult = await client.query(
      `
  SELECT *
  FROM public.recommendation_quarter_history
  WHERE recommendation_id = $1
    AND tahun_periode = $2
    AND is_active = TRUE
  ORDER BY
    updated_at DESC,
    triwulan DESC,
    id DESC
  FOR UPDATE
  `,
      [id, tahunPeriode]
    );

    const activeHistories = activeHistoryResult.rows;
    const sourceHistory = activeHistories[0] ?? null;

    const previousQuarter = sourceHistory
      ? Number(sourceHistory.triwulan)
      : null;

    // 3. Jangan memindahkan riwayat yang sudah difinalisasi.
    const finalizedSourceResult = await client.query(
      `
  SELECT 1
  FROM public.recommendation_quarter_history h
  LEFT JOIN public.dashboard_capaian_triwulan s
    ON s.tahun = h.tahun_periode
    AND s.triwulan = h.triwulan
  WHERE h.recommendation_id = $1
    AND h.tahun_periode = $2
    AND h.is_active = TRUE
    AND (
      h.is_finalized = TRUE
      OR s.is_finalized = TRUE
    )
  LIMIT 1
  `,
      [id, tahunPeriode]
    );

    if (finalizedSourceResult.rows.length > 0) {
      throw new Error(
        "Riwayat triwulan sebelumnya sudah difinalisasi. Batalkan finalisasi terlebih dahulu."
      );
    }

    // 4. Pertahankan status terakhir rekomendasi.
    const followUpStatus =
      sourceHistory?.follow_up_status ??
      recommendation.follow_up_status ??
      "BELUM_TL";

    const saldoStatus =
      sourceHistory?.saldo_status ??
      recommendation.saldo_status ??
      "BELUM_SALDO";

    const capaian = Number(
      sourceHistory?.capaian ??
        recommendation.capaian ??
        calculateCapaian(followUpStatus)
    );

    // 5. Pastikan triwulan tujuan belum difinalisasi.
    const targetFinalizedResult = await client.query(
      `
  SELECT 1
  FROM public.dashboard_capaian_triwulan
  WHERE tahun = $1
    AND triwulan = $2
    AND is_finalized = TRUE
  LIMIT 1
  `,
      [tahunPeriode, targetQuarter]
    );

    if (targetFinalizedResult.rows.length > 0) {
      throw new Error(
        `TW${targetQuarter} sudah difinalisasi dan tidak dapat menerima rekomendasi baru.`
      );
    }

    // 6. Periksa riwayat tujuan.
    const targetHistoryResult = await client.query(
      `
  SELECT *
  FROM public.recommendation_quarter_history
  WHERE recommendation_id = $1
    AND tahun_periode = $2
    AND triwulan = $3
  FOR UPDATE
  `,
      [id, tahunPeriode, targetQuarter]
    );

    const targetHistory = targetHistoryResult.rows[0] ?? null;

    if (targetHistory?.is_finalized === true) {
      throw new Error(
        `Riwayat rekomendasi di TW${targetQuarter} sudah difinalisasi.`
      );
    }

    // 7. Buat atau aktifkan riwayat pada triwulan tujuan.
    const destinationResult = await client.query(
      `
  INSERT INTO public.recommendation_quarter_history (
    recommendation_id,
    tahun_periode,
    triwulan,
    follow_up_status,
    saldo_status,
    capaian,
    is_active,
    is_finalized,
    is_folder_fallback,
    folder_fallback_applied_at
  )
  VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE, FALSE, NULL)

  ON CONFLICT (
    recommendation_id,
    tahun_periode,
    triwulan
  )
  DO UPDATE SET
    follow_up_status = EXCLUDED.follow_up_status,
    saldo_status = EXCLUDED.saldo_status,
    capaian = EXCLUDED.capaian,
    is_active = TRUE,
    is_folder_fallback = FALSE,
    folder_fallback_applied_at = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE
    public.recommendation_quarter_history.is_finalized = FALSE

  RETURNING id
  `,
      [
        id,
        tahunPeriode,
        targetQuarter,
        followUpStatus,
        saldoStatus,
        Number.isFinite(capaian) ? capaian : 0,
      ]
    );

    if (destinationResult.rows.length === 0) {
      throw new Error(`Riwayat TW${targetQuarter} tidak dapat diaktifkan.`);
    }

    // 8. Nonaktifkan riwayat aktif pada triwulan sebelumnya.
    // Riwayat lama tidak dihapus.
    const deactivatePreviousResult = await client.query(
      `
  UPDATE public.recommendation_quarter_history
  SET
    is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
  WHERE recommendation_id = $1
    AND tahun_periode = $2
    AND triwulan <> $3
    AND is_active = TRUE
    AND is_finalized = FALSE
  `,
      [id, tahunPeriode, targetQuarter]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      message: `Rekomendasi berhasil dipindahkan ke TW${targetQuarter}. Riwayat sebelumnya tetap disimpan.`,
      data: {
        id,
        tahun_periode: tahunPeriode,
        triwulan_sebelumnya: previousQuarter,
        triwulan: targetQuarter,
        follow_up_status: followUpStatus,
        saldo_status: saldoStatus,
        riwayat_lama_dinonaktifkan: deactivatePreviousResult.rowCount ?? 0,
      },
    });

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      message: `Rekomendasi berhasil ditambahkan ke riwayat TW${targetQuarter}. Riwayat sebelumnya tetap dipertahankan.`,
      data: {
        id,
        tahun_periode: tahunPeriode,
        triwulan_sebelumnya: previousQuarter,
        triwulan: targetQuarter,
        follow_up_status: followUpStatus,
        saldo_status: saldoStatus,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK PATCH ERROR:", rollbackError);
    }

    console.error("PATCH RECOMMENDATION ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengubah triwulan rekomendasi.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * DELETE
 * Menghapus satu rekomendasi.
 */
export async function DELETE(request: NextRequest) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await ensurePeriodColumn();
    await ensureQuarterHistoryTable();
    await ensureRecommendationSnapshotTable();

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

    await client.query("BEGIN");
    transactionStarted = true;

    // Ambil rekomendasi yang akan dihapus.
    const recommendationResult = await client.query(
      `
      SELECT *
      FROM public.recommendations
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (recommendationResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return NextResponse.json(
        {
          ok: false,
          message: "Data rekomendasi tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    const deleted = recommendationResult.rows[0];

    // Cegah penghapusan rekomendasi yang sudah difinalisasi.
    const finalizedHistoryResult = await client.query(
      `
  SELECT 1
  FROM public.recommendation_quarter_history
  WHERE recommendation_id = $1
    AND is_finalized = TRUE
  LIMIT 1
  `,
      [id]
    );

    if (finalizedHistoryResult.rows.length > 0) {
      throw new Error(
        "Rekomendasi memiliki riwayat triwulan yang sudah difinalisasi sehingga tidak dapat dihapus."
      );
    }
    // Cegah penghapusan rekomendasi yang masuk snapshot final.
    const finalizedSnapshotResult = await client.query(
      `
  SELECT 1
  FROM public.recommendation_quarter_history h
  INNER JOIN public.dashboard_capaian_triwulan s
    ON s.tahun = h.tahun_periode
    AND s.triwulan = h.triwulan
  WHERE h.recommendation_id = $1
    AND s.is_finalized = TRUE
  LIMIT 1
  `,
      [id]
    );

    if (finalizedSnapshotResult.rows.length > 0) {
      throw new Error(
        "Rekomendasi sudah masuk ke snapshot dashboard yang difinalisasi sehingga tidak dapat dihapus."
      );
    }

    // Hapus rekomendasi setelah dipastikan belum difinalisasi.
    const deleteResult = await client.query(
      `
  DELETE FROM public.recommendations
  WHERE id = $1
  RETURNING id
  `,
      [id]
    );

    if (deleteResult.rowCount === 0) {
      throw new Error("Gagal menghapus rekomendasi.");
    }
    // Hitung ulang jumlah rekomendasi asli setelah penghapusan.
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
        AND r.asal_recommendation_id IS NULL
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

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      ok: true,
      message: "Rekomendasi berhasil dihapus.",
      data: deleted,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("ROLLBACK DELETE ERROR:", rollbackError);
      }
    }

    console.error("DELETE RECOMMENDATIONS ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menghapus data rekomendasi.",
      },
      {
        status:
          error instanceof Error &&
          (error.message.includes("sudah difinalisasi") ||
            error.message.includes("dashboard yang difinalisasi") ||
            error.message.includes("salinan bawaan pada triwulan berikutnya"))
            ? 409
            : 500,
      }
    );
  } finally {
    client.release();
  }
}
