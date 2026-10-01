import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

const WEIGHTS = {
  BELUM_TL: 0,
  TL_BELUM_TUNTAS: 0.7,
  TL_SUDAH_TUNTAS: 1,
};

export async function GET() {
  try {
    await pool.query("SELECT 1");

    /*
     * =========================================================
     * SUMMARY SELURUH DATA
     * =========================================================
     *
     * 1 baris pada tabel recommendations = 1 rekomendasi.
     *
     * Capaian =
     * ((TL Belum Tuntas × 70%) +
     *  (TL Sudah Tuntas × 100%))
     * / Total Rekomendasi
     */

    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE follow_up_status = 'BELUM_TL'
        )::int AS belum_tl,

        COUNT(*) FILTER (
          WHERE follow_up_status = 'SUDAH_TL'
        )::int AS tl_belum_tuntas,

        COUNT(*) FILTER (
          WHERE follow_up_status = 'SUDAH_TUNTAS'
        )::int AS tl_sudah_tuntas,

        COUNT(*) FILTER (
          WHERE saldo_status = 'MASUK_SALDO'
        )::int AS masuk_saldo,

        COUNT(*) FILTER (
          WHERE saldo_status = 'BELUM_SALDO'
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
        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE saldo_status = 'MASUK_SALDO'
        )::int AS masuk_saldo,

        COUNT(*) FILTER (
          WHERE saldo_status = 'BELUM_SALDO'
        )::int AS belum_saldo,

        COUNT(*) FILTER (
          WHERE category = 'Laporan Keuangan'
        )::int AS keuangan,

        COUNT(*) FILTER (
          WHERE category = 'Bukan Keuangan'
        )::int AS bukan_keuangan,

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
      WHERE source = 'BPK'
    `);

    /*
     * =========================================================
     * SUMMARY ITJEN
     * =========================================================
     */

    const itjenResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,

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
         * SUDAH TL di sistem = TL Belum Tuntas
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
