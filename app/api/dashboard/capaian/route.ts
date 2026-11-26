import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { PoolClient } from "pg";

import { hitungRumusIndeks } from "@/lib/rumus-indeks";

type ModeIndeks = "MANUAL" | "OTOMATIS";

const RUMUS_CAPAIAN_DEFAULT =
  "((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo";

const RUMUS_PERSENTASE_SALDO_DEFAULT =
  "((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo";

const RUMUS_INDEKS_DEFAULT = "min(capaian / 81 * 100, 120%)";

const RUMUS_TRIWULAN_DEFAULT = {
  1: "min(capaian / 0.40, 120%)",
  2: "min(capaian / 0.50, 120%)",
  3: "min(capaian / 0.62, 120%)",
  4: "min(capaian / 0.81, 120%)",
} as const;

function getDefaultRumusTriwulan(quarter: 1 | 2 | 3 | 4) {
  return RUMUS_TRIWULAN_DEFAULT[quarter];
}

function normalizePercentLiterals(formula: string): string {
  return formula.replace(/(\d+(?:\.\d+)?)\s*%/g, (_match, value: string) =>
    String(Number(value) / 100)
  );
}

function calculateCapaian(
  saldo: number,
  tlBelumTuntas: number,
  tlSudahTuntas: number
): number {
  if (saldo <= 0) return 0;

  return (0.7 * tlBelumTuntas + tlSudahTuntas) / saldo;
}

// Memastikan kolom pada tabel lama tersedia.
// Tidak menghapus data yang sudah tersimpan.
async function ensureCapaianColumns() {
  await pool.query(`
    ALTER TABLE public.dashboard_capaian
      ADD COLUMN IF NOT EXISTS indeks_capaian_manual
        NUMERIC NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS indeks_capaian_mode
        VARCHAR(20) NOT NULL DEFAULT 'OTOMATIS'
  `);
}

// Menyediakan tabel khusus pengaturan setiap periode.
async function ensureCapaianPeriodeTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.dashboard_capaian_periode (
      tahun INTEGER PRIMARY KEY,
      capaian_manual NUMERIC NOT NULL DEFAULT 0,
      indeks_capaian_manual NUMERIC NOT NULL DEFAULT 0,
      indeks_capaian_mode VARCHAR(20) NOT NULL DEFAULT 'OTOMATIS',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT dashboard_capaian_periode_mode_check
        CHECK (
          indeks_capaian_mode IN ('MANUAL', 'OTOMATIS')
        )
    )
  `);
}
// Menyimpan hasil capaian yang sudah difinalisasi per triwulan.
async function ensureQuarterSnapshotTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.dashboard_capaian_triwulan (
      id BIGSERIAL PRIMARY KEY,
      tahun INTEGER NOT NULL,
      triwulan SMALLINT NOT NULL
        CHECK (triwulan BETWEEN 1 AND 4),
      total_masuk_saldo INTEGER NOT NULL DEFAULT 0,
      belum_tl INTEGER NOT NULL DEFAULT 0,
      tl_belum_tuntas INTEGER NOT NULL DEFAULT 0,
      tl_sudah_tuntas INTEGER NOT NULL DEFAULT 0,
      capaian_dasar NUMERIC NOT NULL DEFAULT 0,
      capaian_persen NUMERIC NOT NULL DEFAULT 0,
      rumus_digunakan TEXT NOT NULL,
      rumus_dasar_digunakan TEXT NOT NULL DEFAULT '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo',
      is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
      finalized_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT dashboard_capaian_triwulan_unique
        UNIQUE (tahun, triwulan)
    )
  `);

  await pool.query(`
    ALTER TABLE public.dashboard_capaian_triwulan
    ADD COLUMN IF NOT EXISTS rumus_dasar_digunakan TEXT
    NOT NULL DEFAULT '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo'
  `);
  await pool.query(`
  ALTER TABLE public.dashboard_capaian_triwulan
  ADD COLUMN IF NOT EXISTS total_rekomendasi
  INTEGER NOT NULL DEFAULT 0
`);
}

// Memastikan tabel riwayat triwulan tersedia.
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
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_folder_fallback BOOLEAN NOT NULL DEFAULT FALSE,
      folder_fallback_applied_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT recommendation_quarter_history_unique
        UNIQUE (recommendation_id, tahun_periode, triwulan)
    )
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_quarter_history
    ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await pool.query(`
  ALTER TABLE public.recommendation_quarter_history
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS carry_forward_from_year INTEGER,
    ADD COLUMN IF NOT EXISTS carry_forward_from_quarter SMALLINT,
    ADD COLUMN IF NOT EXISTS is_folder_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS folder_fallback_applied_at TIMESTAMPTZ
`);
}
// Mencatat riwayat yang benar-benar dibuat oleh carry-forward.
// Data ini digunakan untuk pembatalan finalisasi secara aman.
async function ensureCarryForwardTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recommendation_quarter_carry_forward (
      id BIGSERIAL PRIMARY KEY,
      source_year INTEGER NOT NULL,
      source_quarter SMALLINT NOT NULL,
      target_year INTEGER NOT NULL,
      target_quarter SMALLINT NOT NULL,

      source_history_id BIGINT NOT NULL
        REFERENCES public.recommendation_quarter_history(id)
        ON DELETE CASCADE,

      target_history_id BIGINT NOT NULL
        REFERENCES public.recommendation_quarter_history(id)
        ON DELETE CASCADE,

      recommendation_id INTEGER NOT NULL
        REFERENCES public.recommendations(id)
        ON DELETE CASCADE,

      target_history_updated_at TIMESTAMP NOT NULL,

      action_type VARCHAR(20) NOT NULL DEFAULT 'CREATED',

      previous_follow_up_status VARCHAR(50),
      previous_saldo_status VARCHAR(50),
      previous_capaian NUMERIC(5, 2),
      previous_carry_forward_from_year INTEGER,
      previous_carry_forward_from_quarter SMALLINT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT recommendation_quarter_carry_forward_unique
        UNIQUE (source_history_id, target_history_id)
    )
  `);

  // Migrasi tambahan untuk tabel tracking yang sudah terlanjur dibuat.
  await pool.query(`
   ALTER TABLE public.recommendation_quarter_carry_forward
     ADD COLUMN IF NOT EXISTS action_type VARCHAR(20)
       NOT NULL DEFAULT 'CREATED',
     ADD COLUMN IF NOT EXISTS previous_follow_up_status VARCHAR(50),
     ADD COLUMN IF NOT EXISTS previous_saldo_status VARCHAR(50),
     ADD COLUMN IF NOT EXISTS previous_capaian NUMERIC(5, 2),
     ADD COLUMN IF NOT EXISTS previous_carry_forward_from_year INTEGER,
     ADD COLUMN IF NOT EXISTS previous_carry_forward_from_quarter SMALLINT,
     ADD COLUMN IF NOT EXISTS applied_follow_up_status VARCHAR(50),
     ADD COLUMN IF NOT EXISTS applied_saldo_status VARCHAR(50),
     ADD COLUMN IF NOT EXISTS applied_capaian NUMERIC(5, 2)
 `);
}
// Pengaturan rumus berlaku global untuk seluruh periode.

async function getOrCreateRumus() {
  const dbCheck = await pool.query(`
  SELECT
    current_database() AS database,
    current_schema() AS schema,
    current_setting('search_path') AS search_path,
    (
      SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pengaturan_rumus_capaian'
    ) AS columns
`);

  console.log("PEMERIKSAAN DATABASE RUMUS:", dbCheck.rows[0]);
  console.log("TAHAP RUMUS: ALTER TABLE");
  await pool.query(`
  
  ALTER TABLE public.pengaturan_rumus_capaian
    ADD COLUMN IF NOT EXISTS rumus_persentase_saldo TEXT
      NOT NULL DEFAULT '((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo',

      ADD COLUMN IF NOT EXISTS rumus_triwulan_1 TEXT
      NOT NULL DEFAULT 'min(capaian / 0.40, 120%)',
    
    ADD COLUMN IF NOT EXISTS rumus_triwulan_2 TEXT
      NOT NULL DEFAULT 'min(capaian / 0.50, 120%)',
    
    ADD COLUMN IF NOT EXISTS rumus_triwulan_3 TEXT
      NOT NULL DEFAULT 'min(capaian / 0.62, 120%)',
    
    ADD COLUMN IF NOT EXISTS rumus_triwulan_4 TEXT
      NOT NULL DEFAULT 'min(capaian / 0.81, 120%)'
`);
  // Memperbaiki nilai lama yang masih menggunakan rumus capaian dasar.
  // Rumus custom yang pernah disimpan tidak akan ditimpa.
  await pool.query(`
UPDATE public.pengaturan_rumus_capaian
SET
  rumus_triwulan_1 = CASE
    WHEN TRIM(rumus_triwulan_1) =
      '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo'
    THEN 'min(capaian / 0.40, 120%)'
    ELSE rumus_triwulan_1
  END,

  rumus_triwulan_2 = CASE
    WHEN TRIM(rumus_triwulan_2) =
      '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo'
    THEN 'min(capaian / 0.50, 120%)'
    ELSE rumus_triwulan_2
  END,

  rumus_triwulan_3 = CASE
    WHEN TRIM(rumus_triwulan_3) =
      '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo'
    THEN 'min(capaian / 0.62, 120%)'
    ELSE rumus_triwulan_3
  END,

  rumus_triwulan_4 = CASE
    WHEN TRIM(rumus_triwulan_4) =
      '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo'
    THEN 'min(capaian / 0.81, 120%)'
    ELSE rumus_triwulan_4
  END
WHERE id = 1
`);
  console.log("TAHAP RUMUS: INSERT");
  await pool.query(
    `
    INSERT INTO public.pengaturan_rumus_capaian (
      id,
      rumus_capaian,
      rumus_indeks,
      rumus_persentase_saldo,
      versi,
      updated_at
    )
    VALUES (1, $1, $2, $3, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING
    `,
    [
      RUMUS_CAPAIAN_DEFAULT,
      RUMUS_INDEKS_DEFAULT,
      RUMUS_PERSENTASE_SALDO_DEFAULT,
    ]
  );

  console.log("TAHAP RUMUS: SELECT");

  const result = await pool.query(`
    SELECT
      r.id,
      r.rumus_capaian,
      r.rumus_indeks,
      r.rumus_persentase_saldo,
      r.rumus_triwulan_1,
      r.rumus_triwulan_2,
      r.rumus_triwulan_3,
      r.rumus_triwulan_4,
      r.versi,
      r.updated_at
    FROM public.pengaturan_rumus_capaian AS r
    WHERE r.id = 1
    LIMIT 1
  `);

  return result.rows[0];
}

// Membuat pengaturan untuk tahun tertentu jika belum ada.
// Pengaturan lama disalin sebagai nilai awal untuk tahun berjalan.
// Tahun lain dimulai menggunakan mode otomatis.
async function getOrCreateCapaian(year: number) {
  await ensureCapaianPeriodeTable();

  const currentYear = new Date().getFullYear();

  await pool.query(
    `
    INSERT INTO public.dashboard_capaian_periode (
      tahun,
      capaian_manual,
      indeks_capaian_manual,
      indeks_capaian_mode,
      updated_at
    )
    SELECT
      $1::int,

      CASE
        WHEN $1::int = $2::int
        THEN COALESCE(dc.capaian_manual, 0)
        ELSE 0
      END,

      CASE
        WHEN $1::int = $2::int
        THEN COALESCE(dc.indeks_capaian_manual, 0)
        ELSE 0
      END,

      CASE
        WHEN $1::int = $2::int
          AND dc.indeks_capaian_mode = 'MANUAL'
        THEN 'MANUAL'
        ELSE 'OTOMATIS'
      END,

      CURRENT_TIMESTAMP

    FROM (SELECT 1) AS seed
    LEFT JOIN public.dashboard_capaian dc
      ON dc.id = 1

    ON CONFLICT (tahun) DO NOTHING
    `,
    [year, currentYear]
  );

  const result = await pool.query(
    `
    SELECT
      tahun,
      capaian_manual,
      indeks_capaian_manual,
      indeks_capaian_mode,
      updated_at
    FROM public.dashboard_capaian_periode
    WHERE tahun = $1
    LIMIT 1
    `,
    [year]
  );

  return result.rows[0];
}

// Mengambil data rekomendasi sesuai periode.
// year = null berarti seluruh tahun, untuk kompatibilitas
// dengan pemanggilan API lama tanpa parameter year.
// Mengambil data rekomendasi sesuai periode.
// year = null berarti seluruh tahun.

async function getSummary(year: number | null) {
  const result = await pool.query(
    `
    SELECT
    COUNT(*)::int AS total_rekomendasi,

COUNT(*) FILTER (
  WHERE UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
    = 'BELUM_TL'
)::int AS total_belum_tl,

COUNT(*) FILTER (
  WHERE UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
    IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
)::int AS total_tl_belum_tuntas,

COUNT(*) FILTER (
  WHERE UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
  = 'SUDAH_TUNTAS'
)::int AS total_tl_sudah_tuntas,
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
      )::int AS saldo,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
            = 'BELUM_TL'
      )::int AS belum_tl,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
            IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      )::int AS tl_belum_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
          = 'SUDAH_TUNTAS'
      )::int AS tl_sudah_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
      )::int AS masuk_saldo,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
            = 'BELUM_TL'
      )::int AS masuk_belum_tl,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
            IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      )::int AS masuk_tl_belum_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(h.saldo_status, r.saldo_status, '')))
          = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(h.follow_up_status, r.follow_up_status, '')))
          = 'SUDAH_TUNTAS'
      )::int AS masuk_tl_sudah_tuntas

    FROM public.recommendations r

    LEFT JOIN LATERAL (
      SELECT
        qh.follow_up_status,
        qh.saldo_status
      FROM public.recommendation_quarter_history qh
      WHERE qh.recommendation_id = r.id
        AND qh.is_active = TRUE
        AND (
          $1::int IS NULL
          OR qh.tahun_periode = $1::int
        )
      ORDER BY
        qh.tahun_periode DESC,
        qh.triwulan DESC,
        qh.id DESC
      LIMIT 1
    ) h ON TRUE

    WHERE r.asal_recommendation_id IS NULL
      AND (
        $1::int IS NULL
        OR r.tahun_periode = $1::int
        OR h.follow_up_status IS NOT NULL
      )
    `,
    [year]
  );

  return result.rows[0];
}

// Mengambil data rekomendasi berdasarkan tahun dan triwulan LHA/LHP.
async function getSummaryTriwulan(year: number, quarter: number) {
  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS saldo,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(follow_up_status, ''))) = 'BELUM_TL'
          AND UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
    ) AS belum_tl,
    
    COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(follow_up_status, ''))) = 'SUDAH_TL'
          AND UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
    ) AS tl_belum_tuntas,
    
    COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(follow_up_status, ''))) = 'SUDAH_TUNTAS'
          AND UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
    ) AS tl_sudah_tuntas

    FROM public.recommendations

    WHERE lha_date IS NOT NULL
      AND EXTRACT(YEAR FROM lha_date::date) = $1
      AND EXTRACT(QUARTER FROM lha_date::date) = $2
    `,
    [year, quarter]
  );

  return result.rows[0];
}
// Mengambil ringkasan berdasarkan riwayat triwulan
// yang dipilih pada setiap rekomendasi.

async function getSummaryTriwulanHistory(year: number, quarter: number) {
  const result = await pool.query(
    `
    WITH effective_recommendations AS (
      SELECT
        COALESCE(h.follow_up_status, r.follow_up_status) AS follow_up_status,
        COALESCE(h.saldo_status, r.saldo_status) AS saldo_status

      FROM public.recommendations r

      LEFT JOIN LATERAL (
        SELECT
          fq.triwulan_aktif
        FROM public.recommendation_folder_quarter fq
        WHERE fq.source = r.source
          AND COALESCE(fq.category, '') = COALESCE(r.category, '')
          AND COALESCE(fq.lha_number, '') = COALESCE(r.lha_number, '')
          AND fq.tahun_periode = $1
        LIMIT 1
      ) folder_quarter ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          qh.id,
          qh.follow_up_status,
          qh.saldo_status
        FROM public.recommendation_quarter_history qh
        WHERE qh.recommendation_id = r.id
          AND qh.tahun_periode = $1
          AND qh.triwulan = $2
          AND qh.is_active = TRUE
          AND qh.is_folder_fallback = FALSE
        ORDER BY qh.id DESC
        LIMIT 1
      ) h ON TRUE

      WHERE r.asal_recommendation_id IS NULL
        AND (
          h.id IS NOT NULL

          OR (
            NOT EXISTS (
              SELECT 1
              FROM public.recommendation_quarter_history existing_history
              WHERE existing_history.recommendation_id = r.id
                AND existing_history.tahun_periode = $1
                AND existing_history.is_active = TRUE
                AND existing_history.is_folder_fallback = FALSE
            )
            AND folder_quarter.triwulan_aktif = $2
          )
        )
    )

    SELECT
      COUNT(*)::int AS total_rekomendasi,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
      )::int AS saldo,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(follow_up_status, ''))) = 'BELUM_TL'
      )::int AS belum_tl,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(follow_up_status, '')))
            IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      )::int AS tl_belum_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(follow_up_status, '')))
          = 'SUDAH_TUNTAS'
      )::int AS tl_sudah_tuntas

    FROM effective_recommendations
    `,
    [year, quarter]
  );

  return result.rows[0];
}

// GET: membaca capaian dan menghitung indeks.
export async function GET(request: Request) {
  let tahap = "Memulai GET";

  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");

    let year: number | null = null;

    if (yearParam !== null) {
      const parsedYear = Number(yearParam);

      if (
        !/^\d{4}$/.test(yearParam) ||
        !Number.isInteger(parsedYear) ||
        parsedYear < 1900 ||
        parsedYear > 9998
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "Tahun periode tidak valid.",
          },
          { status: 400 }
        );
      }

      year = parsedYear;
    }

    await ensureCapaianColumns();
    await ensureCapaianPeriodeTable();
    await ensureQuarterHistoryTable();
    await ensureQuarterSnapshotTable();

    const settingsYear = year ?? new Date().getFullYear();

    tahap = "Mengambil pengaturan capaian";
    const saved = await getOrCreateCapaian(settingsYear);

    tahap = "Mengambil pengaturan rumus";
    const rumusTersimpan = await getOrCreateRumus();

    tahap = "Mengambil ringkasan rekomendasi";
    const summary = await getSummary(year);

    tahap = "Menghitung data triwulan";

    // =====================================================
    // DATA SELURUH REKOMENDASI
    // =====================================================
    const totalRekomendasi = Number(summary?.total_rekomendasi ?? 0);

    const totalBelumTL = Number(summary?.total_belum_tl ?? 0);
    const totalTLBelumTuntas = Number(summary?.total_tl_belum_tuntas ?? 0);
    const totalTLSudahTuntas = Number(summary?.total_tl_sudah_tuntas ?? 0);

    // =====================================================
    // DATA REKOMENDASI MASUK SALDO
    // =====================================================
    const saldo = Number(summary?.saldo ?? 0);
    const belumTL = Number(summary?.belum_tl ?? 0);
    const tlBelumTuntas = Number(summary?.tl_belum_tuntas ?? 0);
    const tlSudahTuntas = Number(summary?.tl_sudah_tuntas ?? 0);
    // =====================================================
    // PERHITUNGAN 4 TRIWULAN
    // =====================================================

    const rumusDasar =
      String(rumusTersimpan?.rumus_capaian ?? "").trim() ||
      RUMUS_CAPAIAN_DEFAULT;

    const triwulanData = [];

    for (const quarter of [1, 2, 3, 4] as const) {
      const quarterSummary = await getSummaryTriwulanHistory(
        settingsYear,
        quarter
      );

      // Periksa apakah triwulan sudah difinalisasi.
      const snapshotResult = await pool.query(
        `
    SELECT *
    FROM public.dashboard_capaian_triwulan
    WHERE tahun = $1
      AND triwulan = $2
      AND is_finalized = TRUE
    LIMIT 1
    `,
        [settingsYear, quarter]
      );

      const snapshot = snapshotResult.rows[0];

      // Jika sudah final, gunakan snapshot yang tersimpan.
      if (snapshot) {
        triwulanData.push({
          nomor: quarter,
          capaian: Number(snapshot.capaian_persen) / 100,
          capaian_persen: Number(snapshot.capaian_persen),
          capaian_dasar: Number(snapshot.capaian_dasar),
          rumus: snapshot.rumus_digunakan,
          rumus_dasar: snapshot.rumus_dasar_digunakan,
          total_rekomendasi: Number(snapshot.total_rekomendasi ?? 0),
          total_masuk_saldo: Number(snapshot.total_masuk_saldo),
          belum_tl: Number(snapshot.belum_tl),
          tl_belum_tuntas: Number(snapshot.tl_belum_tuntas),
          tl_sudah_tuntas: Number(snapshot.tl_sudah_tuntas),
          is_finalized: true,
          finalized_at: snapshot.finalized_at,
        });

        continue;
      }

      const totalRekomendasiQuarter = Number(
        quarterSummary?.total_rekomendasi ?? 0
      );

      const saldoQuarter = Number(quarterSummary?.saldo ?? 0);
      const belumTLQuarter = Number(quarterSummary?.belum_tl ?? 0);
      const tlBelumTuntasQuarter = Number(quarterSummary?.tl_belum_tuntas ?? 0);
      const tlSudahTuntasQuarter = Number(quarterSummary?.tl_sudah_tuntas ?? 0);

      const rumusKey = `rumus_triwulan_${quarter}` as
        | "rumus_triwulan_1"
        | "rumus_triwulan_2"
        | "rumus_triwulan_3"
        | "rumus_triwulan_4";

      const rumus =
        String(rumusTersimpan?.[rumusKey] ?? "").trim() ||
        getDefaultRumusTriwulan(quarter);

      const capaianDasarQuarter =
        totalRekomendasiQuarter > 0
          ? hitungRumusIndeks(normalizePercentLiterals(rumusDasar), {
              capaian: 0,
              saldo: totalRekomendasiQuarter,
              belum_tl: belumTLQuarter,
              tl_belum_tuntas: tlBelumTuntasQuarter,
              tl_sudah_tuntas: tlSudahTuntasQuarter,
            })
          : 0;

      if (!Number.isFinite(capaianDasarQuarter)) {
        throw new Error(`Capaian dasar Triwulan ${quarter} tidak valid.`);
      }

      const capaianQuarter =
        totalRekomendasiQuarter > 0
          ? hitungRumusIndeks(normalizePercentLiterals(rumus), {
              capaian: capaianDasarQuarter,
              saldo: totalRekomendasiQuarter,
              belum_tl: belumTLQuarter,
              tl_belum_tuntas: tlBelumTuntasQuarter,
              tl_sudah_tuntas: tlSudahTuntasQuarter,
            })
          : 0;

      if (!Number.isFinite(capaianQuarter)) {
        throw new Error(`Hasil perhitungan Triwulan ${quarter} tidak valid.`);
      }

      triwulanData.push({
        nomor: quarter,
        capaian: capaianQuarter,
        capaian_persen: capaianQuarter * 100,
        capaian_dasar: capaianDasarQuarter,
        rumus,
        total_rekomendasi: totalRekomendasiQuarter,
        total_masuk_saldo: saldoQuarter,
        belum_tl: belumTLQuarter,
        tl_belum_tuntas: tlBelumTuntasQuarter,
        tl_sudah_tuntas: tlSudahTuntasQuarter,
        is_finalized: false,
        finalized_at: null,
      });
    }
    // =====================================================
    // CAPAIAN OTOMATIS SELURUH REKOMENDASI
    // Pembagi = total seluruh rekomendasi
    // =====================================================
    const rumusCapaian =
      String(rumusTersimpan?.rumus_capaian ?? "").trim() ||
      RUMUS_CAPAIAN_DEFAULT;

    const capaianOtomatis =
      totalRekomendasi > 0
        ? hitungRumusIndeks(normalizePercentLiterals(rumusCapaian), {
            capaian: 0,
            saldo: totalRekomendasi,
            belum_tl: totalBelumTL,
            tl_belum_tuntas: totalTLBelumTuntas,
            tl_sudah_tuntas: totalTLSudahTuntas,
          })
        : 0;

    if (!Number.isFinite(capaianOtomatis)) {
      throw new Error("Hasil rumus Capaian Otomatis tidak valid.");
    }

    // =====================================================
    // INDEKS CAPAIAN OTOMATIS
    // =====================================================
    const rumusIndeks =
      String(rumusTersimpan?.rumus_indeks ?? "").trim() || RUMUS_INDEKS_DEFAULT;

    const indeksCapaianOtomatis = hitungRumusIndeks(rumusIndeks, {
      capaian: capaianOtomatis,
      saldo: totalRekomendasi,
      tl_belum_tuntas: totalTLBelumTuntas,
      tl_sudah_tuntas: totalTLSudahTuntas,
    });

    // =====================================================
    // PERSENTASE SALDO
    // Pembagi = hanya rekomendasi masuk saldo
    // =====================================================
    const rumusPersentaseSaldo =
      String(rumusTersimpan?.rumus_persentase_saldo ?? "").trim() ||
      RUMUS_PERSENTASE_SALDO_DEFAULT;

    const masukSaldo = Number(summary?.masuk_saldo ?? 0);
    const masukTLBelumTuntas = Number(summary?.masuk_tl_belum_tuntas ?? 0);
    const masukTLSudahTuntas = Number(summary?.masuk_tl_sudah_tuntas ?? 0);

    const persentaseSaldoOtomatis =
      masukSaldo > 0
        ? hitungRumusIndeks(normalizePercentLiterals(rumusPersentaseSaldo), {
            capaian: 0,
            saldo: masukSaldo,
            tl_belum_tuntas: masukTLBelumTuntas,
            tl_sudah_tuntas: masukTLSudahTuntas,
          })
        : 0;
    if (!Number.isFinite(persentaseSaldoOtomatis)) {
      throw new Error("Hasil rumus Persentase Saldo tidak valid.");
    }

    const mode: ModeIndeks =
      saved?.indeks_capaian_mode === "MANUAL" ? "MANUAL" : "OTOMATIS";

    const indeksCapaianManual = Number(saved?.indeks_capaian_manual ?? 0);

    const indeksCapaianMentah =
      mode === "MANUAL" ? indeksCapaianManual / 100 : indeksCapaianOtomatis;

    const indeksCapaian = Number.isFinite(indeksCapaianMentah)
      ? Math.max(0, indeksCapaianMentah)
      : 0;

    return NextResponse.json({
      ok: true,
      year,

      data: {
        rumus: rumusTersimpan,
        triwulan: triwulanData,
        persentase_saldo: persentaseSaldoOtomatis,

        capaian_manual: Number(saved?.capaian_manual ?? 0),

        capaian_otomatis: capaianOtomatis,

        indeks_capaian: indeksCapaian,

        indeks_capaian_manual: indeksCapaianManual,

        indeks_capaian_otomatis: indeksCapaianOtomatis,

        indeks_capaian_mode: mode,

        total_rekomendasi: totalRekomendasi,
        total_belum_tl: totalBelumTL,
        total_tl_belum_tuntas: totalTLBelumTuntas,
        total_tl_sudah_tuntas: totalTLSudahTuntas,

        saldo,
        belum_tl: belumTL,
        tl_belum_tuntas: tlBelumTuntas,
        tl_sudah_tuntas: tlSudahTuntas,

        updated_at: saved?.updated_at,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/capaian ERROR:", {
      tahap,
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        tahap,
        message: "Gagal menghitung capaian dan indeks capaian.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
async function createFolderFallbackHistory(
  client: PoolClient,
  year: number,
  quarter: number
) {
  const result = await client.query(
    `
    INSERT INTO public.recommendation_quarter_history (
      recommendation_id,
      tahun_periode,
      triwulan,
      follow_up_status,
      saldo_status,
      is_finalized,
      is_active,
      is_folder_fallback,
      folder_fallback_applied_at,
      updated_at
    )
    SELECT
    r.id,
    $1::INTEGER,
    $2::SMALLINT,
    COALESCE(NULLIF(TRIM(r.follow_up_status), ''), 'BELUM_TL'),
      COALESCE(NULLIF(TRIM(r.saldo_status), ''), 'BELUM_SALDO'),
      FALSE,
      TRUE,
      TRUE,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM public.recommendations r

    INNER JOIN public.recommendation_folder_quarter fq
      ON fq.source = r.source
      AND COALESCE(fq.category, '') = COALESCE(r.category, '')
      AND COALESCE(fq.lha_number, '') = COALESCE(r.lha_number, '')
      AND fq.tahun_periode = $1

    WHERE r.asal_recommendation_id IS NULL
      AND r.tahun_periode = $1
      AND fq.triwulan_aktif = $2
     

      AND NOT EXISTS (
        SELECT 1
        FROM public.recommendation_quarter_history existing_history
        WHERE existing_history.recommendation_id = r.id
          AND existing_history.tahun_periode = $1
          AND existing_history.is_active = TRUE
          AND existing_history.is_folder_fallback = FALSE
      )

      ON CONFLICT (recommendation_id, tahun_periode, triwulan)
      DO UPDATE SET
        follow_up_status = EXCLUDED.follow_up_status,
        saldo_status = EXCLUDED.saldo_status,
        capaian = EXCLUDED.capaian,
        is_active = TRUE,
        is_finalized = FALSE,
        is_folder_fallback = TRUE,
        folder_fallback_applied_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        public.recommendation_quarter_history.is_active = FALSE
        AND public.recommendation_quarter_history.is_finalized = FALSE
        AND public.recommendation_quarter_history.is_folder_fallback = TRUE
        AND public.recommendation_quarter_history.updated_at
            IS NOT DISTINCT FROM
            public.recommendation_quarter_history.folder_fallback_applied_at
      
      RETURNING id
    `,
    [year, quarter]
  );

  return Number(result.rowCount ?? 0);
}

async function carryForwardUnfinishedRecommendations(
  client: PoolClient,
  year: number,
  quarter: number
) {
  // TW1-TW3 menuju triwulan berikutnya.
  // TW4 menuju TW1 tahun berikutnya.
  const targetYear = quarter === 4 ? year + 1 : year;
  const targetQuarter = quarter === 4 ? 1 : quarter + 1;

  // Ambil rekomendasi yang belum selesai dari riwayat sumber.
  const sourceResult = await client.query(
    `
    SELECT
      r.id,
      r.source,
      r.category,
      r.lha_number,
      h.id AS source_history_id,
      h.follow_up_status,
      h.saldo_status,
      h.capaian
    FROM public.recommendations r
    INNER JOIN public.recommendation_quarter_history h
      ON h.recommendation_id = r.id
    WHERE h.tahun_periode = $1
      AND h.triwulan = $2
      AND h.is_active = TRUE
      AND h.is_finalized = TRUE
      AND r.asal_recommendation_id IS NULL
      AND UPPER(TRIM(COALESCE(h.follow_up_status, '')))
        IN (
          'BELUM_TL',
          'SUDAH_TL',
          'BELUM_TUNTAS',
          'TL_BELUM_TUNTAS'
        )
    ORDER BY r.id
    FOR UPDATE OF r, h
    `,
    [year, quarter]
  );

  let moved = 0;
  let skipped = 0;

  for (const item of sourceResult.rows) {
    const existingResult = await client.query(
      `
      SELECT *
      FROM public.recommendation_quarter_history
      WHERE recommendation_id = $1
        AND tahun_periode = $2
        AND triwulan = $3
      FOR UPDATE
      `,
      [item.id, targetYear, targetQuarter]
    );

    let targetHistory: { id: number; updated_at: Date } | null = null;
    let actionType: "CREATED" | "REACTIVATED";
    let previous: Record<string, unknown> | null = null;

    // Jika riwayat tujuan belum ada, buat riwayat baru
    // menggunakan ID rekomendasi utama yang sama.
    if (existingResult.rows.length === 0) {
      const insertResult = await client.query(
        `
        INSERT INTO public.recommendation_quarter_history (
          recommendation_id,
          tahun_periode,
          triwulan,
          follow_up_status,
          saldo_status,
          capaian,
          is_finalized,
          is_active,
          carry_forward_from_year,
          carry_forward_from_quarter,
          is_folder_fallback
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, TRUE, $7, $8, FALSE)
        ON CONFLICT (recommendation_id, tahun_periode, triwulan)
        DO NOTHING
        RETURNING id, updated_at
        `,
        [
          item.id,
          targetYear,
          targetQuarter,
          item.follow_up_status,
          item.saldo_status,
          item.capaian,
          year,
          quarter,
        ]
      );

      if (insertResult.rows.length === 0) {
        skipped++;
        continue;
      }

      targetHistory = insertResult.rows[0];
      actionType = "CREATED";
    } else {
      const existing = existingResult.rows[0];

      // Jangan menimpa riwayat tujuan yang sudah aktif
      // atau sudah difinalisasi.
      if (existing.is_active || existing.is_finalized) {
        skipped++;
        continue;
      }

      previous = {
        follow_up_status: existing.follow_up_status,
        saldo_status: existing.saldo_status,
        capaian: existing.capaian,
        carry_forward_from_year: existing.carry_forward_from_year,
        carry_forward_from_quarter: existing.carry_forward_from_quarter,
      };

      const updateResult = await client.query(
        `
        UPDATE public.recommendation_quarter_history
        SET
          follow_up_status = $1,
          saldo_status = $2,
          capaian = $3,
          is_active = TRUE,
          is_finalized = FALSE,
          carry_forward_from_year = $4,
          carry_forward_from_quarter = $5,
          is_folder_fallback = FALSE,
          folder_fallback_applied_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
          AND is_active = FALSE
          AND is_finalized = FALSE
        RETURNING id, updated_at
        `,
        [
          item.follow_up_status,
          item.saldo_status,
          item.capaian,
          year,
          quarter,
          existing.id,
        ]
      );

      if (updateResult.rows.length === 0) {
        skipped++;
        continue;
      }

      targetHistory = updateResult.rows[0];
      actionType = "REACTIVATED";
    }

    if (!targetHistory) {
      skipped++;
      continue;
    }

    // Catat agar pembatalan finalisasi dapat mengembalikan
    // riwayat tujuan ke kondisi sebelumnya.
    await client.query(
      `
      INSERT INTO public.recommendation_quarter_carry_forward (
        source_year,
        source_quarter,
        target_year,
        target_quarter,
        source_history_id,
        target_history_id,
        recommendation_id,
        target_history_updated_at,
        action_type,
        previous_follow_up_status,
        previous_saldo_status,
        previous_capaian,
        previous_carry_forward_from_year,
        previous_carry_forward_from_quarter,
        applied_follow_up_status,
        applied_saldo_status,
        applied_capaian
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (source_history_id, target_history_id)
      DO NOTHING
      `,
      [
        year,
        quarter,
        targetYear,
        targetQuarter,
        item.source_history_id,
        targetHistory.id,
        item.id,
        targetHistory.updated_at,
        actionType,
        previous?.follow_up_status ?? null,
        previous?.saldo_status ?? null,
        previous?.capaian ?? null,
        previous?.carry_forward_from_year ?? null,
        previous?.carry_forward_from_quarter ?? null,
        item.follow_up_status,
        item.saldo_status,
        item.capaian,
      ]
    );

    moved++;
  }

  // Siapkan folder tahun tujuan hanya untuk LHP/LHA
  // yang memiliki rekomendasi belum selesai.
  const folderResult = await client.query(
    `
    INSERT INTO public.recommendation_folder_quarter (
      source,
      category,
      lha_number,
      tahun_periode,
      triwulan,
      triwulan_aktif,
      created_at,
      updated_at
    )
    SELECT DISTINCT
  r.source,
  r.category,
  r.lha_number,
  $3::INTEGER,
  $4::SMALLINT,
  $4::SMALLINT,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
    FROM public.recommendations r
    INNER JOIN public.recommendation_quarter_history h
      ON h.recommendation_id = r.id
    WHERE h.tahun_periode = $1
      AND h.triwulan = $2
      AND h.is_active = TRUE
      AND h.is_finalized = TRUE
      AND r.asal_recommendation_id IS NULL
      AND UPPER(TRIM(COALESCE(h.follow_up_status, '')))
        IN (
          'BELUM_TL',
          'SUDAH_TL',
          'BELUM_TUNTAS',
          'TL_BELUM_TUNTAS'
        )
    ON CONFLICT (
      source,
      category,
      lha_number,
      tahun_periode
    )
    DO NOTHING
    `,
    [year, quarter, targetYear, targetQuarter]
  );

  return {
    tahun_asal: year,
    triwulan_asal: quarter,
    tahun_tujuan: targetYear,
    triwulan_tujuan: targetQuarter,
    jumlah_rekomendasi_dibawa: moved,
    jumlah_rekomendasi_dilewati: skipped,
    jumlah_folder_dibawa: Number(folderResult.rowCount ?? 0),
  };
}
// POST: melakukan finalisasi dan menyimpan snapshot triwulan.
export async function POST(request: Request) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await ensureQuarterHistoryTable();
    await ensureQuarterSnapshotTable();
    await ensureCarryForwardTrackingTable();

    const body = await request.json();

    const year = Number(body.year);
    const triwulan = Number(body.triwulan);

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 9998 ||
      ![1, 2, 3, 4].includes(triwulan)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tahun atau pilihan triwulan tidak valid.",
        },
        { status: 400 }
      );
    }

    // Ambil rumus yang saat ini digunakan.
    const rumusTersimpan = await getOrCreateRumus();

    const rumusDasar =
      String(rumusTersimpan?.rumus_capaian ?? "").trim() ||
      RUMUS_CAPAIAN_DEFAULT;

    const rumusKey = `rumus_triwulan_${triwulan}` as
      | "rumus_triwulan_1"
      | "rumus_triwulan_2"
      | "rumus_triwulan_3"
      | "rumus_triwulan_4";

    const rumusTriwulan =
      String(rumusTersimpan?.[rumusKey] ?? "").trim() ||
      getDefaultRumusTriwulan(triwulan as 1 | 2 | 3 | 4);

    await client.query("BEGIN");
    transactionStarted = true;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `${year}:${triwulan}`,
    ]);
    // Buat riwayat untuk rekomendasi yang mengikuti triwulan folder.
    const fallbackCreated = await createFolderFallbackHistory(
      client,
      year,
      triwulan
    );

    console.log(
      `Riwayat fallback yang dibuat untuk TW${triwulan}:`,
      fallbackCreated
    );

    // Kunci sementara riwayat yang akan difinalisasi.
    await client.query(
      `
      SELECT id
      FROM public.recommendation_quarter_history
      WHERE tahun_periode = $1
        AND triwulan = $2
        AND is_active = TRUE
      FOR UPDATE
      `,
      [year, triwulan]
    );

    // Ambil ringkasan khusus triwulan tersebut.
    const summaryResult = await client.query(
      `
      WITH effective_recommendations AS (
        SELECT
          COALESCE(h.follow_up_status, r.follow_up_status)
            AS follow_up_status,
    
          COALESCE(h.saldo_status, r.saldo_status)
            AS saldo_status
    
        FROM public.recommendations r
    
        LEFT JOIN LATERAL (
          SELECT
            fq.triwulan_aktif
          FROM public.recommendation_folder_quarter fq
          WHERE fq.source = r.source
            AND COALESCE(fq.category, '') = COALESCE(r.category, '')
            AND COALESCE(fq.lha_number, '') = COALESCE(r.lha_number, '')
            AND fq.tahun_periode = $1
          LIMIT 1
        ) folder_quarter ON TRUE
    
        LEFT JOIN LATERAL (
          SELECT
            qh.id,
            qh.follow_up_status,
            qh.saldo_status
          FROM public.recommendation_quarter_history qh
          WHERE qh.recommendation_id = r.id
            AND qh.tahun_periode = $1
            AND qh.triwulan = $2
            AND qh.is_active = TRUE
            AND qh.is_folder_fallback = FALSE
          ORDER BY qh.id DESC
          LIMIT 1
        ) h ON TRUE
    
        WHERE r.asal_recommendation_id IS NULL
          AND (
            h.id IS NOT NULL
            OR (
              NOT EXISTS (
                SELECT 1
                FROM public.recommendation_quarter_history existing_history
                WHERE existing_history.recommendation_id = r.id
                  AND existing_history.tahun_periode = $1
                  AND existing_history.is_active = TRUE
                  AND existing_history.is_folder_fallback = FALSE
              )
              AND folder_quarter.triwulan_aktif = $2
            )
          )
      )
    
      SELECT
        COUNT(*)::int AS total_rekomendasi,
    
        COUNT(*) FILTER (
          WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
        )::int AS saldo,
    
        COUNT(*) FILTER (
          WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
            AND UPPER(TRIM(COALESCE(follow_up_status, ''))) = 'BELUM_TL'
        )::int AS belum_tl,
    
        COUNT(*) FILTER (
          WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
            AND UPPER(TRIM(COALESCE(follow_up_status, '')))
              IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
        )::int AS tl_belum_tuntas,
    
        COUNT(*) FILTER (
          WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
            AND UPPER(TRIM(COALESCE(follow_up_status, '')))
            = 'SUDAH_TUNTAS'
        )::int AS tl_sudah_tuntas
    
      FROM effective_recommendations
      `,
      [year, triwulan]
    );

    const summary = summaryResult.rows[0];

    const totalRekomendasi = Number(summary?.total_rekomendasi ?? 0);

    const saldo = Number(summary?.saldo ?? 0);
    const belumTL = Number(summary?.belum_tl ?? 0);
    const tlBelumTuntas = Number(summary?.tl_belum_tuntas ?? 0);
    const tlSudahTuntas = Number(summary?.tl_sudah_tuntas ?? 0);

    const capaianDasar =
      totalRekomendasi > 0
        ? hitungRumusIndeks(normalizePercentLiterals(rumusDasar), {
            capaian: 0,
            saldo: totalRekomendasi,
            belum_tl: belumTL,
            tl_belum_tuntas: tlBelumTuntas,
            tl_sudah_tuntas: tlSudahTuntas,
          })
        : 0;

    if (!Number.isFinite(capaianDasar)) {
      throw new Error("Perhitungan capaian dasar tidak valid.");
    }

    // Hitung persentase akhir sesuai rumus triwulan.
    const capaian =
      totalRekomendasi > 0
        ? hitungRumusIndeks(normalizePercentLiterals(rumusTriwulan), {
            capaian: capaianDasar,
            saldo: totalRekomendasi,
            belum_tl: belumTL,
            tl_belum_tuntas: tlBelumTuntas,
            tl_sudah_tuntas: tlSudahTuntas,
          })
        : 0;

    if (!Number.isFinite(capaian)) {
      throw new Error(`Perhitungan Triwulan ${triwulan} tidak valid.`);
    }

    // Simpan snapshot secara permanen.
    const snapshotResult = await client.query(
      `
    INSERT INTO public.dashboard_capaian_triwulan (
  tahun,
  triwulan,
  total_rekomendasi,
  total_masuk_saldo,
  belum_tl,
  tl_belum_tuntas,
  tl_sudah_tuntas,
  capaian_dasar,
  capaian_persen,
  rumus_digunakan,
  rumus_dasar_digunakan,
  is_finalized,
  finalized_at,
  updated_at
)
      VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
      ON CONFLICT (tahun, triwulan) DO NOTHING
      RETURNING *
      `,
      [
        year,
        triwulan,
        totalRekomendasi,
        saldo,
        belumTL,
        tlBelumTuntas,
        tlSudahTuntas,
        capaianDasar,
        capaian * 100,
        rumusTriwulan,
        rumusDasar,
      ]
    );

    if (snapshotResult.rowCount === 0) {
      throw new Error(
        `Triwulan ${triwulan} tahun ${year} sudah memiliki snapshot.`
      );
    }
    // Kunci seluruh riwayat pada triwulan yang sudah difinalisasi.
    await client.query(
      `
      UPDATE public.recommendation_quarter_history
      SET is_finalized = TRUE
      WHERE tahun_periode = $1
        AND triwulan = $2
        AND is_active = TRUE
  `,
      [year, triwulan]
    );
    // Bawa rekomendasi yang sudah tuntas dan masuk saldo
    // ke triwulan berikutnya. TW4 tidak melakukan carry forward.
    const carryForwardResult = await carryForwardUnfinishedRecommendations(
      client,
      year,
      triwulan
    );
    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      ok: true,
      message: `Triwulan ${triwulan} tahun ${year} berhasil difinalisasi.`,
      data: snapshotResult.rows[0],
      carry_forward: carryForwardResult,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("ROLLBACK FINALISASI ERROR:", rollbackError);
      }
    }

    console.error("FINALISASI TRIWULAN ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal melakukan finalisasi triwulan.",
      },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}
// DELETE: membatalkan finalisasi triwulan secara aman.
export async function DELETE(request: Request) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await ensureQuarterHistoryTable();
    await ensureQuarterSnapshotTable();
    await ensureCarryForwardTrackingTable();

    const body = await request.json();

    const year = Number(body.year);
    const quarter = Number(body.triwulan);

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 9998 ||
      !Number.isInteger(quarter) ||
      quarter < 1 ||
      quarter > 4
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tahun atau pilihan triwulan tidak valid.",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");
    transactionStarted = true;

    // Gunakan kunci yang sama dengan proses finalisasi.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `${year}:${quarter}`,
    ]);

    // Pastikan snapshot memang sudah difinalisasi.
    const snapshotResult = await client.query(
      `
      SELECT id
      FROM public.dashboard_capaian_triwulan
      WHERE tahun = $1
        AND triwulan = $2
        AND is_finalized = TRUE
      FOR UPDATE
      `,
      [year, quarter]
    );

    if (snapshotResult.rows.length === 0) {
      throw new Error(`TW${quarter} tahun ${year} belum difinalisasi.`);
    }

    // Jangan membatalkan triwulan sebelumnya jika
    // ada triwulan setelahnya yang sudah difinalisasi.
    const laterSnapshotResult = await client.query(
      `
      SELECT triwulan
      FROM public.dashboard_capaian_triwulan
      WHERE tahun = $1
        AND triwulan > $2
        AND is_finalized = TRUE
      ORDER BY triwulan ASC
      LIMIT 1
      `,
      [year, quarter]
    );

    if (laterSnapshotResult.rows.length > 0) {
      const laterQuarter = Number(laterSnapshotResult.rows[0].triwulan);

      throw new Error(
        `Pembatalan TW${quarter} tidak dapat dilakukan karena TW${laterQuarter} sudah difinalisasi. Batalkan finalisasi TW${laterQuarter} terlebih dahulu.`
      );
    }
    // Khusus TW4, periksa apakah tahun berikutnya
    // sudah memiliki triwulan yang difinalisasi.
    if (quarter === 4) {
      const nextYearSnapshotResult = await client.query(
        `
    SELECT triwulan
    FROM public.dashboard_capaian_triwulan
    WHERE tahun = $1
      AND is_finalized = TRUE
    ORDER BY triwulan ASC
    LIMIT 1
    `,
        [year + 1]
      );

      if (nextYearSnapshotResult.rows.length > 0) {
        const nextQuarter = Number(nextYearSnapshotResult.rows[0].triwulan);

        throw new Error(
          `Pembatalan TW4 tahun ${year} tidak dapat dilakukan karena TW${nextQuarter} tahun ${
            year + 1
          } sudah difinalisasi. Batalkan finalisasi tahun tujuan terlebih dahulu.`
        );
      }
    }

    // Nonaktifkan hanya riwayat tujuan yang:
    // 1. Benar-benar dibuat oleh carry-forward ini.
    // 2. Belum diedit setelah dibuat.
    // 3. Belum difinalisasi.

    // =====================================================
    // 1. NONAKTIFKAN RIWAYAT YANG DIBUAT BARU
    // =====================================================

    const createdResult = await client.query(
      `
  UPDATE public.recommendation_quarter_history h
  SET is_active = FALSE
  FROM public.recommendation_quarter_carry_forward cf
  WHERE cf.source_year = $1
    AND cf.source_quarter = $2
    AND cf.target_history_id = h.id
    AND cf.action_type = 'CREATED'
    AND h.is_active = TRUE
    AND h.is_finalized = FALSE
    AND h.follow_up_status
    IS NOT DISTINCT FROM cf.applied_follow_up_status
AND h.saldo_status
    IS NOT DISTINCT FROM cf.applied_saldo_status
AND h.capaian
    IS NOT DISTINCT FROM cf.applied_capaian
  `,
      [year, quarter]
    );

    // =====================================================
    // 2. PULIHKAN RIWAYAT YANG DIAKTIFKAN KEMBALI
    // =====================================================

    const reactivatedResult = await client.query(
      `
  UPDATE public.recommendation_quarter_history h
  SET
    follow_up_status = cf.previous_follow_up_status,
    saldo_status = cf.previous_saldo_status,
    capaian = cf.previous_capaian,
    is_active = FALSE,
    carry_forward_from_year =
      cf.previous_carry_forward_from_year,
    carry_forward_from_quarter =
      cf.previous_carry_forward_from_quarter
  FROM public.recommendation_quarter_carry_forward cf
  WHERE cf.source_year = $1
    AND cf.source_quarter = $2
    AND cf.target_history_id = h.id
    AND cf.action_type = 'REACTIVATED'
    AND h.is_active = TRUE
    AND h.is_finalized = FALSE
    AND h.follow_up_status
  IS NOT DISTINCT FROM cf.applied_follow_up_status
AND h.saldo_status
  IS NOT DISTINCT FROM cf.applied_saldo_status
AND h.capaian
  IS NOT DISTINCT FROM cf.applied_capaian
  `,
      [year, quarter]
    );

    // Hapus riwayat fallback yang dibuat otomatis saat finalisasi.
    // Hanya hapus jika belum mengalami perubahan setelah dibuat.
    const fallbackDeleteResult = await client.query(
      `
  DELETE FROM public.recommendation_quarter_history h
  WHERE h.tahun_periode = $1
    AND h.triwulan = $2
    AND h.is_folder_fallback = TRUE
    AND h.is_active = TRUE
    AND h.is_finalized = TRUE
    AND h.folder_fallback_applied_at IS NOT NULL
    AND h.updated_at = h.folder_fallback_applied_at
  `,
      [year, quarter]
    );
    const deactivateResult = {
      rowCount:
        Number(createdResult.rowCount ?? 0) +
        Number(reactivatedResult.rowCount ?? 0),
    };

    // Riwayat sumber dikembalikan menjadi belum final.
    // Data status dan capaian tidak diubah.
    const sourceResult = await client.query(
      `
      UPDATE public.recommendation_quarter_history
      SET is_finalized = FALSE
      WHERE tahun_periode = $1
        AND triwulan = $2
        AND is_active = TRUE
        AND is_finalized = TRUE
      `,
      [year, quarter]
    );

    // Hapus catatan carry-forward milik finalisasi ini.
    await client.query(
      `
      DELETE FROM public.recommendation_quarter_carry_forward
      WHERE source_year = $1
        AND source_quarter = $2
      `,
      [year, quarter]
    );

    // Hapus snapshot supaya triwulan dapat difinalisasi ulang.
    await client.query(
      `
      DELETE FROM public.dashboard_capaian_triwulan
      WHERE tahun = $1
        AND triwulan = $2
        AND is_finalized = TRUE
      `,
      [year, quarter]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      ok: true,
      message: `Finalisasi TW${quarter} tahun ${year} berhasil dibatalkan.`,
      data: {
        riwayat_sumber_dikembalikan: sourceResult.rowCount ?? 0,
        riwayat_otomatis_dinonaktifkan: deactivateResult.rowCount ?? 0,
        riwayat_folder_otomatis_dihapus: fallbackDeleteResult.rowCount ?? 0,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("ROLLBACK PEMBATALAN ERROR:", rollbackError);
      }
    }

    console.error("PEMBATALAN FINALISASI ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal membatalkan finalisasi triwulan.",
      },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}
// PUT: menyimpan rumus, capaian manual, atau pengaturan indeks.
export async function PUT(request: Request) {
  try {
    await ensureCapaianColumns();
    await ensureCapaianPeriodeTable();

    const body = await request.json();
    const { searchParams } = new URL(request.url);

    const requestedYear = body.year ?? searchParams.get("year");

    const yearText =
      requestedYear === null || requestedYear === undefined
        ? String(new Date().getFullYear())
        : String(requestedYear);

    const settingsYear = Number(yearText);

    if (
      !/^\d{4}$/.test(yearText) ||
      !Number.isInteger(settingsYear) ||
      settingsYear < 1900 ||
      settingsYear > 9998
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tahun periode tidak valid.",
        },
        { status: 400 }
      );
    }

    // Pastikan baris pengaturan untuk periode terpilih tersedia.
    await getOrCreateCapaian(settingsYear);

    // =====================================================
    // SIMPAN RUMUS TRIWULAN SECARA TERPISAH
    // =====================================================

    const quarterFormulaColumns = {
      rumus_triwulan_1: "rumus_triwulan_1",
      rumus_triwulan_2: "rumus_triwulan_2",
      rumus_triwulan_3: "rumus_triwulan_3",
      rumus_triwulan_4: "rumus_triwulan_4",
    } as const;

    const quarterFormulaKey = (
      Object.keys(quarterFormulaColumns) as Array<
        keyof typeof quarterFormulaColumns
      >
    ).find((key) => body[key] !== undefined);

    if (quarterFormulaKey) {
      const rumusTriwulan = String(body[quarterFormulaKey] ?? "").trim();

      if (!rumusTriwulan) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus triwulan tidak boleh kosong.",
          },
          { status: 400 }
        );
      }

      await getOrCreateRumus();

      try {
        const hasilUji = hitungRumusIndeks(
          normalizePercentLiterals(rumusTriwulan),
          {
            capaian: 0.5,
            saldo: 10,
            belum_tl: 3,
            tl_belum_tuntas: 3,
            tl_sudah_tuntas: 4,
          }
        );

        if (!Number.isFinite(hasilUji)) {
          throw new Error("Hasil rumus bukan angka yang valid.");
        }
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus triwulan tidak valid.",
            error:
              error instanceof Error
                ? error.message
                : "Rumus tidak dapat dihitung.",
          },
          { status: 400 }
        );
      }

      const column = quarterFormulaColumns[quarterFormulaKey];

      await pool.query(
        `
    UPDATE public.pengaturan_rumus_capaian
    SET
      ${column} = $1,
      versi = versi + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    `,
        [rumusTriwulan]
      );

      return NextResponse.json({
        ok: true,
        year: settingsYear,
        message: `Rumus ${quarterFormulaKey
          .replaceAll("_", " ")
          .toUpperCase()} berhasil disimpan.`,
      });
    }

    // =====================================================
    // 1. SIMPAN RUMUS
    // Rumus tetap berlaku global, sedangkan mode indeks
    // hanya diubah untuk periode terpilih.
    // =====================================================
    if (body.rumus_persentase_saldo !== undefined) {
      const rumusPersentaseSaldo = String(
        body.rumus_persentase_saldo ?? ""
      ).trim();

      if (!rumusPersentaseSaldo) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Persentase Saldo tidak boleh kosong.",
          },
          { status: 400 }
        );
      }

      await getOrCreateRumus();

      try {
        const hasilUji = hitungRumusIndeks(
          normalizePercentLiterals(rumusPersentaseSaldo),
          {
            capaian: 0.5,
            saldo: 10,
            tl_belum_tuntas: 3,
            tl_sudah_tuntas: 4,
          }
        );

        if (!Number.isFinite(hasilUji)) {
          throw new Error("Hasil rumus bukan angka yang valid.");
        }
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Persentase Saldo tidak valid.",
            error:
              error instanceof Error
                ? error.message
                : "Rumus tidak dapat dihitung.",
          },
          { status: 400 }
        );
      }

      await pool.query(
        `
        UPDATE public.pengaturan_rumus_capaian
        SET
          rumus_persentase_saldo = $1,
          versi = versi + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `,
        [rumusPersentaseSaldo]
      );

      return NextResponse.json({
        ok: true,
        year: settingsYear,
        message: "Rumus Persentase Saldo berhasil disimpan.",
      });
    }

    // SIMPAN RUMUS CAPAIAN SAJA
    if (body.rumus_capaian !== undefined && body.rumus_indeks === undefined) {
      const rumusCapaian = String(body.rumus_capaian ?? "").trim();

      if (!rumusCapaian) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Capaian tidak boleh kosong.",
          },
          { status: 400 }
        );
      }

      await getOrCreateRumus();

      try {
        const hasilUji = hitungRumusIndeks(
          normalizePercentLiterals(rumusCapaian),
          {
            capaian: 0.5,
            saldo: 10,
            tl_belum_tuntas: 3,
            tl_sudah_tuntas: 4,
            belum_tl: 3,
          }
        );

        if (!Number.isFinite(hasilUji)) {
          throw new Error("Hasil rumus bukan angka yang valid.");
        }
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Capaian tidak valid.",
            error:
              error instanceof Error
                ? error.message
                : "Rumus tidak dapat dihitung.",
          },
          { status: 400 }
        );
      }

      await pool.query(
        `
            UPDATE public.pengaturan_rumus_capaian
            SET
              rumus_capaian = $1,
              versi = versi + 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
            `,
        [rumusCapaian]
      );

      return NextResponse.json({
        ok: true,
        year: settingsYear,
        message: "Rumus Capaian berhasil disimpan.",
      });
    }
    // =====================================================
    // SIMPAN RUMUS INDEKS CAPAIAN SAJA
    // Tidak mengubah rumus Capaian atau Persentase Saldo.
    // =====================================================

    if (body.rumus_indeks !== undefined && body.rumus_capaian === undefined) {
      const rumusIndeks = String(body.rumus_indeks ?? "").trim();

      if (!rumusIndeks) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Indeks Capaian tidak boleh kosong.",
          },
          { status: 400 }
        );
      }

      await getOrCreateRumus();

      try {
        const hasilUji = hitungRumusIndeks(rumusIndeks, {
          capaian: 0.5,
          saldo: 10,
          tl_belum_tuntas: 3,
          tl_sudah_tuntas: 4,
        });

        if (!Number.isFinite(hasilUji)) {
          throw new Error("Hasil rumus bukan angka yang valid.");
        }
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Indeks Capaian tidak valid.",
            error:
              error instanceof Error
                ? error.message
                : "Rumus tidak dapat dihitung.",
          },
          { status: 400 }
        );
      }

      await pool.query(
        `
        UPDATE public.pengaturan_rumus_capaian
        SET
          rumus_indeks = $1,
          versi = versi + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `,
        [rumusIndeks]
      );

      await pool.query(
        `
        UPDATE public.dashboard_capaian_periode
        SET
          indeks_capaian_mode = 'OTOMATIS',
          updated_at = CURRENT_TIMESTAMP
        WHERE tahun = $1
        `,
        [settingsYear]
      );

      return NextResponse.json({
        ok: true,
        year: settingsYear,
        message: "Rumus Indeks Capaian berhasil disimpan.",
      });
    }
    if (body.rumus_capaian !== undefined || body.rumus_indeks !== undefined) {
      const rumusCapaian = String(body.rumus_capaian ?? "").trim();

      const rumusIndeks = String(body.rumus_indeks ?? "").trim();

      if (!rumusCapaian || !rumusIndeks) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Capaian dan Rumus Indeks wajib diisi.",
          },
          { status: 400 }
        );
      }

      try {
        hitungRumusIndeks(rumusIndeks, {
          capaian: 0.5,
          saldo: 10,
          tl_belum_tuntas: 3,
          tl_sudah_tuntas: 4,
        });
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            message: "Rumus Indeks Capaian tidak valid.",
            error:
              error instanceof Error
                ? error.message
                : "Rumus tidak dapat dihitung.",
          },
          { status: 400 }
        );
      }

      await pool.query(
        `
        INSERT INTO public.pengaturan_rumus_capaian (
          id,
          rumus_capaian,
          rumus_indeks,
          versi,
          updated_at
        )
        VALUES (1, $1, $2, 1, CURRENT_TIMESTAMP)

        ON CONFLICT (id) DO UPDATE SET
          rumus_capaian = EXCLUDED.rumus_capaian,
          rumus_indeks = EXCLUDED.rumus_indeks,
          versi = public.pengaturan_rumus_capaian.versi + 1,
          updated_at = CURRENT_TIMESTAMP
        `,
        [rumusCapaian, rumusIndeks]
      );

      await pool.query(
        `
        UPDATE public.dashboard_capaian_periode
        SET
          indeks_capaian_mode = 'OTOMATIS',
          updated_at = CURRENT_TIMESTAMP
        WHERE tahun = $1
        `,
        [settingsYear]
      );

      return NextResponse.json({
        ok: true,
        year: settingsYear,
        message:
          "Rumus berhasil disimpan. Mode indeks periode terpilih diaktifkan ke otomatis.",
      });
    }

    // =====================================================
    // 2. SIMPAN CAPAIAN MANUAL PER TAHUN
    // =====================================================

    if (body.capaian_manual !== undefined) {
      const capaian = Number(body.capaian_manual);

      if (!Number.isFinite(capaian) || capaian < 0 || capaian > 100) {
        return NextResponse.json(
          {
            ok: false,
            message: "Capaian manual harus antara 0–100%.",
          },
          { status: 400 }
        );
      }

      await pool.query(
        `
        INSERT INTO public.dashboard_capaian_periode (
          tahun,
          capaian_manual,
          indeks_capaian_manual,
          indeks_capaian_mode,
          updated_at
        )
        VALUES (
          $1,
          $2,
          0,
          'OTOMATIS',
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (tahun) DO UPDATE SET
          capaian_manual = EXCLUDED.capaian_manual,
          updated_at = CURRENT_TIMESTAMP
        `,
        [settingsYear, capaian]
      );
    }

    // =====================================================
    // 3. SIMPAN MODE DAN NILAI INDEKS PER TAHUN
    // =====================================================

    const mode = body.indeks_capaian_mode as ModeIndeks | undefined;

    if (mode !== undefined) {
      if (mode !== "MANUAL" && mode !== "OTOMATIS") {
        return NextResponse.json(
          {
            ok: false,
            message: "Mode indeks harus MANUAL atau OTOMATIS.",
          },
          { status: 400 }
        );
      }

      let nilaiManual: number | null = null;

      if (body.indeks_capaian_manual !== undefined) {
        const kandidatManual = Number(body.indeks_capaian_manual);

        if (
          !Number.isFinite(kandidatManual) ||
          kandidatManual < 0 ||
          kandidatManual > 120
        ) {
          return NextResponse.json(
            {
              ok: false,
              message: "Indeks Capaian manual harus antara 0–120%.",
            },
            { status: 400 }
          );
        }

        nilaiManual = kandidatManual;
      }

      await pool.query(
        `
        INSERT INTO public.dashboard_capaian_periode (
          tahun,
          capaian_manual,
          indeks_capaian_manual,
          indeks_capaian_mode,
          updated_at
        )
        VALUES (
          $1,
          0,
          COALESCE($3, 0),
          $2,
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (tahun) DO UPDATE SET
          indeks_capaian_manual = COALESCE(
            $3,
            public.dashboard_capaian_periode.indeks_capaian_manual
          ),
          indeks_capaian_mode = EXCLUDED.indeks_capaian_mode,
          updated_at = CURRENT_TIMESTAMP
        `,
        [settingsYear, mode, nilaiManual]
      );
    }

    // =====================================================
    // 4. KEMBALIKAN PENGATURAN TAHUN TERPILIH
    // =====================================================

    const result = await pool.query(
      `
      SELECT
        tahun,
        capaian_manual,
        indeks_capaian_manual,
        indeks_capaian_mode,
        updated_at
      FROM public.dashboard_capaian_periode
      WHERE tahun = $1
      LIMIT 1
      `,
      [settingsYear]
    );

    return NextResponse.json({
      ok: true,
      year: settingsYear,
      data: result.rows[0],
      message: "Pengaturan capaian berhasil disimpan.",
    });
  } catch (error) {
    console.error("PUT /api/dashboard/capaian ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal menyimpan pengaturan capaian.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
