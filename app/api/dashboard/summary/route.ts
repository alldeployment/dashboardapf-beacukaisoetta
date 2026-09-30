import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

const WEIGHTS = {
  BELUM_TL: 0,
  TL_BELUM_TUNTAS: 70,
  TL_SUDAH_TUNTAS: 100,
};

export async function GET() {
  try {
    await pool.query("SELECT 1");

    /*
     * =========================================================
     * SUMMARY SELURUH DATA
     * =========================================================
     *
     * Rumus mengikuti Excel:
     *
     * Capaian =
     * ((TL Belum Tuntas × 70%) +
     *  (TL Sudah Tuntas × 100%))
     * / Total Rekomendasi
     *
     * Belum TL = 0%
     */

    const result = await pool.query(`
      SELECT
        COALESCE(SUM(recommendation_count), 0)::int AS total,

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
        )::int AS tl_sudah_tuntas,

        COALESCE(
          SUM(recommendation_count)
          FILTER (
            WHERE saldo_status = 'MASUK_SALDO'
          ),
          0
        )::int AS masuk_saldo,

        COALESCE(
          SUM(recommendation_count)
          FILTER (
            WHERE saldo_status = 'BELUM_SALDO'
          ),
          0
        )::int AS belum_saldo

      FROM recommendations
    `);

    /*
     * =========================================================
     * SUMMARY BPK
     * =========================================================
     */

    const bpkResult = await pool.query(`
      SELECT
        COALESCE(SUM(recommendation_count), 0)::int AS total,

        COALESCE(
          SUM(recommendation_count)
          FILTER (
            WHERE saldo_status = 'MASUK_SALDO'
          ),
          0
        )::int AS masuk_saldo,

        COALESCE(
          SUM(recommendation_count)
          FILTER (
            WHERE saldo_status = 'BELUM_SALDO'
          ),
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
      WHERE source = 'BPK'
    `);

    /*
     * =========================================================
     * SUMMARY ITJEN
     * =========================================================
     */

    const itjenResult = await pool.query(`
      SELECT
        COALESCE(SUM(recommendation_count), 0)::int AS total,

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
      WHERE source = 'ITJEN'
    `);

    const row = result.rows[0];
    const bpk = bpkResult.rows[0];
    const itjen = itjenResult.rows[0];

    const total = Number(row.total) || 0;

    const belumTl = Number(row.belum_tl) || 0;
    const tlBelumTuntas = Number(row.tl_belum_tuntas) || 0;
    const tlSudahTuntas = Number(row.tl_sudah_tuntas) || 0;

    const masukSaldo = Number(row.masuk_saldo) || 0;
    const belumSaldo = Number(row.belum_saldo) || 0;

    /*
     * =========================================================
     * RUMUS CAPAIAN SESUAI EXCEL
     * =========================================================
     *
     * Excel:
     *
     * =((70%*G7)+(100%*H7))/E7
     *
     * Web:
     *
     * =((70 * TL_BELUM_TUNTAS)
     *   +(100 * TL_SUDAH_TUNTAS))
     *  / TOTAL
     */

    const capaian =
      total > 0
        ? (tlBelumTuntas * WEIGHTS.TL_BELUM_TUNTAS +
            tlSudahTuntas * WEIGHTS.TL_SUDAH_TUNTAS) /
          total
        : 0;

    /*
     * =========================================================
     * PERSENTASE SALDO
     * =========================================================
     */

    const persentaseSaldo = total > 0 ? (masukSaldo / total) * 100 : 0;

    const persentaseBelumSaldo = total > 0 ? (belumSaldo / total) * 100 : 0;

    /*
     * =========================================================
     * BPK
     * =========================================================
     */

    const bpkTotal = Number(bpk.total) || 0;
    const bpkMasukSaldo = Number(bpk.masuk_saldo) || 0;

    const bpkPersentaseSaldo =
      bpkTotal > 0 ? (bpkMasukSaldo / bpkTotal) * 100 : 0;

    /*
     * =========================================================
     * RESPONSE
     * =========================================================
     */

    return NextResponse.json({
      ok: true,

      data: {
        total,

        belumTl,

        /*
         * Nama ini tetap dibuat agar tidak merusak
         * struktur frontend yang sudah ada.
         *
         * SUDAH TL di sistem = TL Belum Tuntas
         * sesuai rumus Excel = 70%
         */
        sudahTl: tlBelumTuntas,

        sudahTuntas: tlSudahTuntas,

        masukSaldo,
        belumSaldo,

        persentaseSaldo: Number(persentaseSaldo.toFixed(2)),

        persentaseBelumSaldo: Number(persentaseBelumSaldo.toFixed(2)),

        /*
         * HASIL RUMUS EXCEL
         */
        capaian: Number(capaian.toFixed(2)),

        capaianWeights: {
          BELUM_TL: 0,
          SUDAH_TL: 70,
          SUDAH_TUNTAS: 100,
        },

        bpk: {
          total: bpkTotal,

          belumTl: Number(bpk.belum_tl) || 0,

          /*
           * SUDAH TL = TL BELUM TUNTAS
           */
          sudahTl: Number(bpk.tl_belum_tuntas) || 0,

          sudahTuntas: Number(bpk.tl_sudah_tuntas) || 0,

          masukSaldo: bpkMasukSaldo,

          belumSaldo: Number(bpk.belum_saldo) || 0,

          keuangan: Number(bpk.keuangan) || 0,

          bukanKeuangan: Number(bpk.bukan_keuangan) || 0,

          persentaseSaldo: Number(bpkPersentaseSaldo.toFixed(2)),
        },

        itjen: {
          total: Number(itjen.total) || 0,

          belumTl: Number(itjen.belum_tl) || 0,

          sudahTl: Number(itjen.tl_belum_tuntas) || 0,

          sudahTuntas: Number(itjen.tl_sudah_tuntas) || 0,
        },
      },
    });
  } catch (error) {
    console.error("========== DASHBOARD SUMMARY ERROR ==========");

    console.error(error);

    console.error("=============================================");

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil summary dashboard",
      },
      {
        status: 500,
      }
    );
  }
}
