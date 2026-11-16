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
const RUMUS_TRIWULAN_DEFAULT = "min(capaian / 81 * 100, 120%)";

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
      NOT NULL DEFAULT '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo',

    ADD COLUMN IF NOT EXISTS rumus_triwulan_2 TEXT
      NOT NULL DEFAULT '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo',

    ADD COLUMN IF NOT EXISTS rumus_triwulan_3 TEXT
      NOT NULL DEFAULT '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo',

    ADD COLUMN IF NOT EXISTS rumus_triwulan_4 TEXT
      NOT NULL DEFAULT '((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo'
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
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
      )::int AS saldo,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
        AND UPPER(TRIM(COALESCE(
          r.follow_up_status, h.follow_up_status, ''
        ))) = 'BELUM_TL'
      )::int AS belum_tl,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
        AND UPPER(TRIM(COALESCE(
          r.follow_up_status, h.follow_up_status, ''
        ))) IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      )::int AS tl_belum_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
        AND UPPER(TRIM(COALESCE(
          r.follow_up_status, h.follow_up_status, ''
        ))) IN ('SUDAH_TUNTAS', 'TL_SUDAH_TUNTAS')
      )::int AS tl_sudah_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
      )::int AS masuk_saldo,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
        AND UPPER(TRIM(COALESCE(
          r.follow_up_status, h.follow_up_status, ''
        ))) = 'BELUM_TL'
      )::int AS masuk_belum_tl,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
        AND UPPER(TRIM(COALESCE(
          r.follow_up_status, h.follow_up_status, ''
        ))) IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      )::int AS masuk_tl_belum_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(
          r.saldo_status, h.saldo_status, ''
        ))) = 'MASUK_SALDO'
        AND UPPER(TRIM(COALESCE(
          r.follow_up_status, h.follow_up_status, ''
        ))) IN ('SUDAH_TUNTAS', 'TL_SUDAH_TUNTAS')
      )::int AS masuk_tl_sudah_tuntas

    FROM public.recommendations r

    LEFT JOIN LATERAL (
      SELECT
        qh.follow_up_status,
        qh.saldo_status
      FROM public.recommendation_quarter_history qh
      WHERE qh.recommendation_id = r.id
        AND qh.tahun_periode = r.tahun_periode
      ORDER BY qh.triwulan DESC
      LIMIT 1
    ) h ON TRUE

    WHERE $1::int IS NULL
       OR r.tahun_periode = $1::int
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
      )::int AS belum_tl,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(follow_up_status, '')))
          IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      )::int AS tl_belum_tuntas,

      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(follow_up_status, '')))
          IN ('SUDAH_TUNTAS', 'TL_SUDAH_TUNTAS')
      )::int AS tl_sudah_tuntas

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
    SELECT
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
            IN ('SUDAH_TUNTAS', 'TL_SUDAH_TUNTAS')
      )::int AS tl_sudah_tuntas,

      COUNT(*)::int AS total_rekomendasi

    FROM public.recommendation_quarter_history

    WHERE tahun_periode = $1
      AND triwulan = $2
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

    const saldo = Number(summary?.saldo ?? 0);
    const belumTL = Number(summary?.belum_tl ?? 0);
    const tlBelumTuntas = Number(summary?.tl_belum_tuntas ?? 0);
    const tlSudahTuntas = Number(summary?.tl_sudah_tuntas ?? 0);

    // =====================================================
    // PERHITUNGAN 4 TRIWULAN
    // KHUSUS REKOMENDASI MASUK SALDO
    // Setiap triwulan memiliki rumus tersendiri.
    // =====================================================

    const rumusDasar =
      String(rumusTersimpan?.rumus_capaian ?? "").trim() ||
      RUMUS_CAPAIAN_DEFAULT;

    const triwulanData = [];

    for (const quarter of [1, 2, 3, 4] as const) {
      // Ambil seluruh riwayat rekomendasi pada triwulan ini.
      const quarterSummary = await getSummaryTriwulanHistory(
        settingsYear,
        quarter
      );
      // Ambil snapshot finalisasi jika triwulan sudah difinalisasi.
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

      // Jika sudah difinalisasi, gunakan hasil snapshot.
      // Jangan menghitung ulang dari riwayat.
      if (snapshot) {
        triwulanData.push({
          nomor: quarter,

          capaian: Number(snapshot.capaian_persen) / 100,
          capaian_persen: Number(snapshot.capaian_persen),

          capaian_dasar: Number(snapshot.capaian_dasar),

          rumus: snapshot.rumus_digunakan,
          rumus_dasar: snapshot.rumus_dasar_digunakan,

          total_rekomendasi: Number(quarterSummary?.total_rekomendasi ?? 0),

          total_masuk_saldo: Number(snapshot.total_masuk_saldo),
          belum_tl: Number(snapshot.belum_tl),
          tl_belum_tuntas: Number(snapshot.tl_belum_tuntas),
          tl_sudah_tuntas: Number(snapshot.tl_sudah_tuntas),

          is_finalized: true,
          finalized_at: snapshot.finalized_at,
        });

        continue;
      }
      // Jumlah seluruh rekomendasi, termasuk yang belum masuk saldo.
      const totalRekomendasiQuarter = Number(
        quarterSummary?.total_rekomendasi ?? 0
      );

      // Jumlah rekomendasi yang masuk saldo.
      const saldoQuarter = Number(quarterSummary?.saldo ?? 0);

      const belumTLQuarter = Number(quarterSummary?.belum_tl ?? 0);

      const tlBelumTuntasQuarter = Number(quarterSummary?.tl_belum_tuntas ?? 0);

      const tlSudahTuntasQuarter = Number(quarterSummary?.tl_sudah_tuntas ?? 0);

      // Ambil rumus khusus triwulan.
      const rumusKey = `rumus_triwulan_${quarter}` as
        | "rumus_triwulan_1"
        | "rumus_triwulan_2"
        | "rumus_triwulan_3"
        | "rumus_triwulan_4";

      const rumus =
        String(rumusTersimpan?.[rumusKey] ?? "").trim() ||
        RUMUS_TRIWULAN_DEFAULT;

      // Hitung capaian dasar.
      const capaianDasarQuarter =
        saldoQuarter > 0
          ? hitungRumusIndeks(normalizePercentLiterals(rumusDasar), {
              capaian: 0,
              saldo: saldoQuarter,
              belum_tl: belumTLQuarter,
              tl_belum_tuntas: tlBelumTuntasQuarter,
              tl_sudah_tuntas: tlSudahTuntasQuarter,
            })
          : 0;

      if (!Number.isFinite(capaianDasarQuarter)) {
        throw new Error(`Capaian dasar Triwulan ${quarter} tidak valid.`);
      }

      // Hitung persentase capaian triwulan.
      const capaianQuarter =
        saldoQuarter > 0
          ? hitungRumusIndeks(normalizePercentLiterals(rumus), {
              capaian: capaianDasarQuarter,
              saldo: saldoQuarter,
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
    // Capaian Otomatis dihitung berdasarkan seluruh rekomendasi.
    const rumusCapaian =
      String(rumusTersimpan?.rumus_capaian ?? "").trim() ||
      RUMUS_CAPAIAN_DEFAULT;

    const capaianOtomatis =
      saldo > 0
        ? hitungRumusIndeks(normalizePercentLiterals(rumusCapaian), {
            capaian: 0,
            saldo,
            belum_tl: belumTL,
            tl_belum_tuntas: tlBelumTuntas,
            tl_sudah_tuntas: tlSudahTuntas,
          })
        : 0;

    if (!Number.isFinite(capaianOtomatis)) {
      throw new Error("Hasil rumus Capaian Otomatis tidak valid.");
    }

    const rumusIndeks =
      String(rumusTersimpan?.rumus_indeks ?? "").trim() || RUMUS_INDEKS_DEFAULT;

    const indeksCapaianOtomatis = hitungRumusIndeks(rumusIndeks, {
      capaian: capaianOtomatis,
      saldo,
      tl_belum_tuntas: tlBelumTuntas,
      tl_sudah_tuntas: tlSudahTuntas,
    });
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
async function carryForwardUnfinishedRecommendations(
  client: PoolClient,
  year: number
) {
  const nextYear = year + 1;

  // Ambil rekomendasi yang belum tuntas berdasarkan riwayat TW4.
  const sourceResult = await client.query(
    `
    SELECT
      r.*,
      h.follow_up_status AS status_akhir,
      h.saldo_status AS saldo_akhir
    FROM public.recommendations r
    INNER JOIN public.recommendation_quarter_history h
      ON h.recommendation_id = r.id
    WHERE h.tahun_periode = $1
      AND h.triwulan = 4
      AND UPPER(TRIM(h.follow_up_status))
        IN ('BELUM_TL', 'SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      AND (
        r.asal_recommendation_id IS NULL
        OR r.asal_recommendation_id = r.id
      )
    ORDER BY r.id
    FOR UPDATE OF r
    `,
    [year]
  );

  let copied = 0;

  for (const item of sourceResult.rows) {
    const insertResult = await client.query(
      `
      INSERT INTO public.recommendations (
        source,
        category,
        lha_number,
        lha_date,
        recommendation_count,
        follow_up_status,
        saldo_status,
        description,
        recommendation,
        recommendation_number,
        temuan,
        capaian,
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
        project_id,
        tahun_periode,
        asal_recommendation_id,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (asal_recommendation_id, tahun_periode)
      WHERE asal_recommendation_id IS NOT NULL
      DO NOTHING
      RETURNING id
      `,
      [
        item.source,
        item.category,
        item.lha_number,
        item.lha_date,
        item.recommendation_count,
        item.status_akhir,
        item.saldo_akhir,
        item.description,
        item.recommendation,
        item.recommendation_number,
        item.temuan,
        item.capaian,
        item.keterangan_1,
        item.keterangan_2,
        item.keterangan_3,
        item.no_temuan,
        item.judul,
        item.rencana_aksi,
        item.keterangan_bukti_dukung,
        item.waktu_pelaksanaan,
        item.uic,
        item.tindak_lanjut,
        item.project_id,
        nextYear,
        item.asal_recommendation_id ?? item.id,
      ]
    );

    const newId = insertResult.rows[0]?.id;

    // Jika sudah pernah disalin, jangan membuat riwayat ulang.
    if (!newId) continue;

    await client.query(
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
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, 1, $3, $4, 0,
        FALSE, TRUE, $5, 4,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (recommendation_id, tahun_periode, triwulan)
      DO NOTHING
      `,
      [newId, nextYear, item.status_akhir, item.saldo_akhir, year]
    );

    copied++;
  }

  // Siapkan folder LHA/LHP tahun berikutnya pada TW1.
  await client.query(
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
      $2,
      1,
      1,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM public.recommendations r
    WHERE r.tahun_periode = $1
      AND r.asal_recommendation_id IS NOT NULL
    ON CONFLICT (
      source,
      category,
      lha_number,
      tahun_periode
    )
    DO UPDATE SET
      triwulan = 1,
      triwulan_aktif = 1,
      updated_at = CURRENT_TIMESTAMP
    `,
    [nextYear, nextYear]
  );

  return {
    tahun_asal: year,
    tahun_tujuan: nextYear,
    jumlah_dibawa: copied,
  };
}

// POST: melakukan finalisasi dan menyimpan snapshot triwulan.
export async function POST(request: Request) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await ensureQuarterHistoryTable();
    await ensureQuarterSnapshotTable();

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
      String(rumusTersimpan?.[rumusKey] ?? "").trim() || RUMUS_TRIWULAN_DEFAULT;

    await client.query("BEGIN");
    transactionStarted = true;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `${year}:${triwulan}`,
    ]);

    // Kunci sementara riwayat yang akan difinalisasi.
    await client.query(
      `
      SELECT id
      FROM public.recommendation_quarter_history
      WHERE tahun_periode = $1
        AND triwulan = $2
      FOR UPDATE
      `,
      [year, triwulan]
    );

    // Ambil ringkasan khusus triwulan tersebut.
    const summaryResult = await client.query(
      `
      SELECT
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
              IN ('SUDAH_TUNTAS', 'TL_SUDAH_TUNTAS')
        )::int AS tl_sudah_tuntas

      FROM public.recommendation_quarter_history
      WHERE tahun_periode = $1
        AND triwulan = $2
      `,
      [year, triwulan]
    );

    const summary = summaryResult.rows[0];

    const saldo = Number(summary?.saldo ?? 0);
    const belumTL = Number(summary?.belum_tl ?? 0);
    const tlBelumTuntas = Number(summary?.tl_belum_tuntas ?? 0);
    const tlSudahTuntas = Number(summary?.tl_sudah_tuntas ?? 0);

    if (saldo === 0) {
      throw new Error(
        `Belum ada rekomendasi masuk saldo pada Triwulan ${triwulan}.`
      );
    }

    // Hitung capaian dasar.
    const capaianDasar = hitungRumusIndeks(
      normalizePercentLiterals(rumusDasar),
      {
        capaian: 0,
        saldo,
        belum_tl: belumTL,
        tl_belum_tuntas: tlBelumTuntas,
        tl_sudah_tuntas: tlSudahTuntas,
      }
    );

    if (!Number.isFinite(capaianDasar)) {
      throw new Error("Perhitungan capaian dasar tidak valid.");
    }

    // Hitung persentase akhir sesuai rumus triwulan.
    const capaian = hitungRumusIndeks(normalizePercentLiterals(rumusTriwulan), {
      capaian: capaianDasar,
      saldo,
      belum_tl: belumTL,
      tl_belum_tuntas: tlBelumTuntas,
      tl_sudah_tuntas: tlSudahTuntas,
    });

    if (!Number.isFinite(capaian)) {
      throw new Error(`Perhitungan Triwulan ${triwulan} tidak valid.`);
    }

    // Simpan snapshot secara permanen.
    const snapshotResult = await client.query(
      `
      INSERT INTO public.dashboard_capaian_triwulan (
        tahun,
        triwulan,
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
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
  SET
    is_finalized = TRUE,
    updated_at = CURRENT_TIMESTAMP
  WHERE tahun_periode = $1
    AND triwulan = $2
  `,
      [year, triwulan]
    );
    // Jika TW4 difinalisasi, bawa rekomendasi belum selesai ke tahun berikutnya.
    let carryForwardResult = null;

    if (triwulan === 4) {
      carryForwardResult = await carryForwardUnfinishedRecommendations(
        client,
        year
      );
    }
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
