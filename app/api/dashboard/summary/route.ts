import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

const WEIGHTS = {
  BELUM_TL: 0,
  SUDAH_TL: 70,
  SUDAH_TUNTAS: 100,
};

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(SUM(recommendation_count), 0)::int AS total,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'BELUM_TL'),
          0
        )::int AS belum_tl,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'SUDAH_TL'),
          0
        )::int AS sudah_tl,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'SUDAH_TUNTAS'),
          0
        )::int AS sudah_tuntas,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE saldo_status = 'MASUK_SALDO'),
          0
        )::int AS masuk_saldo,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE saldo_status = 'BELUM_SALDO'),
          0
        )::int AS belum_saldo

      FROM recommendations
    `);

    const bpkResult = await pool.query(`
      SELECT
        COALESCE(SUM(recommendation_count), 0)::int AS total,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE saldo_status = 'MASUK_SALDO'),
          0
        )::int AS masuk_saldo,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE saldo_status = 'BELUM_SALDO'),
          0
        )::int AS belum_saldo,

        COALESCE(
          SUM(recommendation_count)
          FILTER (
            WHERE category = 'Laporan Keuangan'
          ),
          0
        )::int AS keuangan,

        COALESCE(
          SUM(recommendation_count)
          FILTER (
            WHERE category = 'Bukan Keuangan'
          ),
          0
        )::int AS bukan_keuangan,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'BELUM_TL'),
          0
        )::int AS belum_tl,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'SUDAH_TL'),
          0
        )::int AS sudah_tl,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'SUDAH_TUNTAS'),
          0
        )::int AS sudah_tuntas

      FROM recommendations
      WHERE source = 'BPK'
    `);

    const itjenResult = await pool.query(`
      SELECT
        COALESCE(SUM(recommendation_count), 0)::int AS total,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'BELUM_TL'),
          0
        )::int AS belum_tl,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'SUDAH_TL'),
          0
        )::int AS sudah_tl,

        COALESCE(
          SUM(recommendation_count)
          FILTER (WHERE follow_up_status = 'SUDAH_TUNTAS'),
          0
        )::int AS sudah_tuntas

      FROM recommendations
      WHERE source = 'ITJEN'
    `);

    const row = result.rows[0];
    const bpk = bpkResult.rows[0];
    const itjen = itjenResult.rows[0];

    const total = Number(row.total);
    const belumTl = Number(row.belum_tl);
    const sudahTl = Number(row.sudah_tl);
    const sudahTuntas = Number(row.sudah_tuntas);

    const masukSaldo = Number(row.masuk_saldo);
    const belumSaldo = Number(row.belum_saldo);

    const persentaseSaldo = total > 0 ? (masukSaldo / total) * 100 : 0;

    const persentaseBelumSaldo = total > 0 ? (belumSaldo / total) * 100 : 0;

    const capaian =
      total > 0
        ? (belumTl * WEIGHTS.BELUM_TL +
            sudahTl * WEIGHTS.SUDAH_TL +
            sudahTuntas * WEIGHTS.SUDAH_TUNTAS) /
          total
        : 0;

    const bpkTotal = Number(bpk.total);
    const bpkMasukSaldo = Number(bpk.masuk_saldo);

    const bpkPersentaseSaldo =
      bpkTotal > 0 ? (bpkMasukSaldo / bpkTotal) * 100 : 0;

    return NextResponse.json({
      ok: true,

      data: {
        total,
        belumTl,
        sudahTl,
        sudahTuntas,

        masukSaldo,
        belumSaldo,

        persentaseSaldo: Number(persentaseSaldo.toFixed(2)),

        persentaseBelumSaldo: Number(persentaseBelumSaldo.toFixed(2)),

        capaian: Number(capaian.toFixed(2)),

        capaianWeights: WEIGHTS,

        bpk: {
          total: bpkTotal,
          belumTl: Number(bpk.belum_tl),
          sudahTl: Number(bpk.sudah_tl),
          sudahTuntas: Number(bpk.sudah_tuntas),

          masukSaldo: bpkMasukSaldo,
          belumSaldo: Number(bpk.belum_saldo),

          keuangan: Number(bpk.keuangan),
          bukanKeuangan: Number(bpk.bukan_keuangan),

          persentaseSaldo: Number(bpkPersentaseSaldo.toFixed(2)),
        },

        itjen: {
          total: Number(itjen.total),
          belumTl: Number(itjen.belum_tl),
          sudahTl: Number(itjen.sudah_tl),
          sudahTuntas: Number(itjen.sudah_tuntas),
        },
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal mengambil summary dashboard",
      },
      { status: 500 }
    );
  }
}
