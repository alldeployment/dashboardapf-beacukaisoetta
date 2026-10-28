import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hitungRumusIndeks } from "@/lib/rumus-indeks";

type ModeIndeks = "MANUAL" | "OTOMATIS";

const RUMUS_CAPAIAN_DEFAULT =
  "((70% * tl_belum_tuntas) + (100% * tl_sudah_tuntas)) / saldo";

const RUMUS_PERSENTASE_SALDO_DEFAULT =
  "((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo";

const RUMUS_INDEKS_DEFAULT = "min(capaian / 81 * 100, 120%)";

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

// Pengaturan rumus berlaku global untuk seluruh periode.

async function getOrCreateRumus() {
  await pool.query(`
    ALTER TABLE public.pengaturan_rumus_capaian
    ADD COLUMN IF NOT EXISTS rumus_persentase_saldo TEXT
    NOT NULL DEFAULT '((70% * tl_belum_tuntas) + tl_sudah_tuntas) / saldo'
  `);

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

  const result = await pool.query(`
    SELECT
      id,
      rumus_capaian,
      rumus_indeks,
      rumus_persentase_saldo,
      versi,
      updated_at
    FROM public.pengaturan_rumus_capaian
    WHERE id = 1
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
      )::int AS tl_sudah_tuntas,
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
      )::int AS masuk_saldo,
      
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(follow_up_status, '')))
            IN ('SUDAH_TL', 'BELUM_TUNTAS', 'TL_BELUM_TUNTAS')
      )::int AS masuk_tl_belum_tuntas,
      
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(saldo_status, ''))) = 'MASUK_SALDO'
          AND UPPER(TRIM(COALESCE(follow_up_status, '')))
            IN ('SUDAH_TUNTAS', 'TL_SUDAH_TUNTAS')
      )::int AS masuk_tl_sudah_tuntas
    FROM public.recommendations
    WHERE $1::int IS NULL
       OR tahun_periode = $1::int
    `,
    [year]
  );

  return result.rows[0];
}

// GET: membaca capaian dan menghitung indeks.
export async function GET(request: Request) {
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

    const settingsYear = year ?? new Date().getFullYear();

    const [saved, rumusTersimpan, summary] = await Promise.all([
      getOrCreateCapaian(settingsYear),
      getOrCreateRumus(),
      getSummary(year),
    ]);

    const saldo = Number(summary?.saldo ?? 0);
    const belumTL = Number(summary?.belum_tl ?? 0);
    const tlBelumTuntas = Number(summary?.tl_belum_tuntas ?? 0);
    const tlSudahTuntas = Number(summary?.tl_sudah_tuntas ?? 0);

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
