import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hitungRumusIndeks } from "@/lib/rumus-indeks";

type ModeIndeks = "MANUAL" | "OTOMATIS";

const RUMUS_CAPAIAN_DEFAULT =
  "((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo";

const RUMUS_INDEKS_DEFAULT = "min(capaian / 0.62, 1.2)";

// Capaian Keseluruhan dihitung terpisah dari Indeks Capaian.
function calculateCapaian(
  saldo: number,
  tlBelumTuntas: number,
  tlSudahTuntas: number
): number {
  if (saldo <= 0) return 0;

  return (0.7 * tlBelumTuntas + tlSudahTuntas) / saldo;
}

async function ensureCapaianColumns() {
  await pool.query(`
    ALTER TABLE public.dashboard_capaian
    ADD COLUMN IF NOT EXISTS indeks_capaian_manual
      NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS indeks_capaian_mode
      VARCHAR(20) NOT NULL DEFAULT 'OTOMATIS'
  `);
}

// Mengambil pengaturan rumus aktif dari database.
// Jika belum ada, gunakan rumus default.
async function getOrCreateRumus() {
  await pool.query(
    `
    INSERT INTO pengaturan_rumus_capaian (
      id,
      rumus_capaian,
      rumus_indeks,
      versi,
      updated_at
    )
    VALUES (1, $1, $2, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING
  `,
    [RUMUS_CAPAIAN_DEFAULT, RUMUS_INDEKS_DEFAULT]
  );

  const result = await pool.query(`
    SELECT
      id,
      rumus_capaian,
      rumus_indeks,
      versi,
      updated_at
    FROM pengaturan_rumus_capaian
    WHERE id = 1
    LIMIT 1
  `);

  return result.rows[0];
}

// Mengambil atau membuat pengaturan capaian.
async function getOrCreateCapaian() {
  await pool.query(`
    INSERT INTO public.dashboard_capaian (
      id,
      capaian_manual,
      indeks_capaian_manual,
      indeks_capaian_mode,
      updated_at
    )
    VALUES (1, 0, 0, 'OTOMATIS', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING
  `);

  const result = await pool.query(`
    SELECT
      id,
      capaian_manual,
      indeks_capaian_manual,
      indeks_capaian_mode,
      updated_at
    FROM public.dashboard_capaian
    WHERE id = 1
    LIMIT 1
  `);

  return result.rows[0];
}

// Mengambil ringkasan rekomendasi.
async function getSummary() {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS saldo,
      COUNT(*) FILTER (
        WHERE follow_up_status = 'BELUM_TL'
      )::int AS belum_tl,
      COUNT(*) FILTER (
        WHERE follow_up_status = 'SUDAH_TL'
      )::int AS tl_belum_tuntas,
      COUNT(*) FILTER (
        WHERE follow_up_status = 'SUDAH_TUNTAS'
      )::int AS tl_sudah_tuntas
    FROM recommendations
  `);

  return result.rows[0];
}

// GET: mengambil capaian dan menghitung indeks menggunakan rumus aktif.
export async function GET() {
  try {
    const cek = await pool.query(`
SELECT
  current_database() AS database_name,
  current_schema() AS schema_name,
  current_setting('search_path') AS search_path,
  to_regclass('public.dashboard_capaian') AS tabel_capaian,
  (
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dashboard_capaian'
  ) AS kolom_capaian
`);

    const [saved, rumusTersimpan, summary] = await Promise.all([
      getOrCreateCapaian(),
      getOrCreateRumus(),
      getSummary(),
    ]);

    const saldo = Number(summary?.saldo ?? 0);
    const belumTL = Number(summary?.belum_tl ?? 0);
    const tlBelumTuntas = Number(summary?.tl_belum_tuntas ?? 0);
    const tlSudahTuntas = Number(summary?.tl_sudah_tuntas ?? 0);

    const capaianOtomatis = calculateCapaian(
      saldo,
      tlBelumTuntas,
      tlSudahTuntas
    );

    const rumusIndeks =
      String(rumusTersimpan?.rumus_indeks ?? "").trim() || RUMUS_INDEKS_DEFAULT;

    const indeksCapaianOtomatis = hitungRumusIndeks(rumusIndeks, {
      capaian: capaianOtomatis,
      saldo,
      tl_belum_tuntas: tlBelumTuntas,
      tl_sudah_tuntas: tlSudahTuntas,
    });

    const mode: ModeIndeks =
      saved?.indeks_capaian_mode === "MANUAL" ? "MANUAL" : "OTOMATIS";

    const indeksCapaianManual = Number(saved?.indeks_capaian_manual ?? 0);

    // Nilai yang ditampilkan mengikuti mode aktif.
    const indeksCapaian =
      mode === "MANUAL" ? indeksCapaianManual / 100 : indeksCapaianOtomatis;

    return NextResponse.json({
      ok: true,
      data: {
        rumus: rumusTersimpan,

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
    console.error("GET /api/dashboard/capaian ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal menghitung capaian dan indeks capaian.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT: menyimpan rumus atau memperbarui nilai capaian.
export async function PUT(request: Request) {
  try {
    await ensureCapaianColumns();
    const body = await request.json();

    // 1. Simpan rumus global.
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

      // Validasi rumus sebelum menyimpannya.
      // Jika tidak valid, penyimpanan dibatalkan.
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
          INSERT INTO pengaturan_rumus_capaian (
            id,
            rumus_capaian,
            rumus_indeks,
            versi,
            updated_at
          )
          VALUES (
            1, $1, $2, 1, CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO UPDATE SET
            rumus_capaian = EXCLUDED.rumus_capaian,
            rumus_indeks = EXCLUDED.rumus_indeks,
            versi = pengaturan_rumus_capaian.versi + 1,
            updated_at = CURRENT_TIMESTAMP
        `,
        [rumusCapaian, rumusIndeks]
      );

      // Setelah rumus diubah, aktifkan mode otomatis.
      // Nilai manual lama tetap tersimpan, tetapi tidak digunakan
      // sebagai nilai Indeks Capaian yang sedang ditampilkan.
      await pool.query(`
        INSERT INTO dashboard_capaian (
          id,
          capaian_manual,
          indeks_capaian_manual,
          indeks_capaian_mode,
          updated_at
        )
        VALUES (
          1, 0, 0, 'OTOMATIS', CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          indeks_capaian_mode = 'OTOMATIS',
          updated_at = CURRENT_TIMESTAMP
      `);

      return NextResponse.json({
        ok: true,
        message:
          "Rumus berhasil disimpan dan mode Indeks Capaian diaktifkan ke otomatis.",
      });
    }

    // 2. Simpan Capaian Keseluruhan manual.
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
          INSERT INTO dashboard_capaian (
            id,
            capaian_manual,
            indeks_capaian_manual,
            indeks_capaian_mode,
            updated_at
          )
          VALUES (1, $1, 0, 'OTOMATIS', CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            capaian_manual = EXCLUDED.capaian_manual,
            updated_at = CURRENT_TIMESTAMP
        `,
        [capaian]
      );
    }

    // 3. Perbarui mode Indeks Capaian.
    const mode = body.indeks_capaian_mode as ModeIndeks | undefined;

    if (mode !== undefined) {
      if (mode !== "MANUAL" && mode !== "OTOMATIS") {
        return NextResponse.json(
          {
            ok: false,
            message: "Mode Indeks Capaian harus MANUAL atau OTOMATIS.",
          },
          { status: 400 }
        );
      }

      let nilaiManual: number | null = null;

      if (body.indeks_capaian_manual !== undefined) {
        nilaiManual = Number(body.indeks_capaian_manual);

        if (
          !Number.isFinite(nilaiManual) ||
          nilaiManual < 0 ||
          nilaiManual > 120
        ) {
          return NextResponse.json(
            {
              ok: false,
              message: "Indeks Capaian manual harus antara 0–120%.",
            },
            { status: 400 }
          );
        }
      }

      await pool.query(
        `
          INSERT INTO dashboard_capaian (
            id,
            capaian_manual,
            indeks_capaian_manual,
            indeks_capaian_mode,
            updated_at
          )
          VALUES (
            1,
            0,
            COALESCE($2, 0),
            $1,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO UPDATE SET
            indeks_capaian_manual =
              COALESCE(
                $2,
                dashboard_capaian.indeks_capaian_manual
              ),
            indeks_capaian_mode = $1,
            updated_at = CURRENT_TIMESTAMP
        `,
        [mode, nilaiManual]
      );
    }

    // 4. Kembalikan pengaturan terbaru.
    const result = await pool.query(`
      SELECT
        id,
        capaian_manual,
        indeks_capaian_manual,
        indeks_capaian_mode,
        updated_at
      FROM dashboard_capaian
      WHERE id = 1
      LIMIT 1
    `);

    return NextResponse.json({
      ok: true,
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
