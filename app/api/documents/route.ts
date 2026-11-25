import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { pool } from "@/lib/db";

// ==========================================
// GET - Mengambil daftar dokumen/link
// ==========================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get("scope");
    const recommendationId = searchParams.get("recommendationId");
    const source = searchParams.get("source");
    const lhaNumber = searchParams.get("lhaNumber");
    const lhaDate = searchParams.get("lhaDate");

    let result;

    if (scope === "RECOMMENDATION" && recommendationId) {
      result = await pool.query(
        `
        SELECT *
        FROM public.document_files
        WHERE recommendation_id = $1
          AND document_scope = 'RECOMMENDATION'
        ORDER BY created_at DESC
        `,
        [recommendationId]
      );
    } else if (scope === "FOLDER" && source && lhaNumber) {
      result = await pool.query(
        `
        SELECT *
        FROM public.document_files
        WHERE source = $1
          AND lha_number = $2
          AND ($3::date IS NULL OR lha_date = $3::date)
          AND document_scope = 'FOLDER'
        ORDER BY created_at DESC
        `,
        [source, lhaNumber, lhaDate || null]
      );
    } else {
      result = await pool.query(`
        SELECT *
        FROM public.document_files
        ORDER BY created_at DESC
      `);
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("GET documents error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal mengambil dokumen",
      },
      { status: 500 }
    );
  }
}

// ==========================================
// POST - Menyimpan URL/link dokumen
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const source = String(body.source || "").trim();
    const lhaNumber = String(body.lhaNumber || "").trim();
    const lhaDate = body.lhaDate ? String(body.lhaDate) : null;

    const scope = String(body.documentScope || "");
    const fileName = String(body.fileName || "").trim();
    const fileUrl = String(body.fileUrl || "").trim();

    const recommendationId = body.recommendationId
      ? Number(body.recommendationId)
      : null;

    // Validasi source dan nomor LHA
    if (!source || !lhaNumber) {
      return NextResponse.json(
        { error: "Source dan nomor LHA wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi scope
    if (scope !== "FOLDER" && scope !== "RECOMMENDATION") {
      return NextResponse.json(
        { error: "Document scope tidak valid" },
        { status: 400 }
      );
    }

    // Validasi URL
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return NextResponse.json(
        { error: "URL tidak valid. Masukkan link yang benar." },
        { status: 400 }
      );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Link harus menggunakan HTTP atau HTTPS" },
        { status: 400 }
      );
    }

    // Validasi judul link
    if (!fileName) {
      return NextResponse.json(
        { error: "Nama atau judul dokumen wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi ID rekomendasi
    if (
      scope === "RECOMMENDATION" &&
      (!recommendationId ||
        !Number.isSafeInteger(recommendationId) ||
        recommendationId <= 0)
    ) {
      return NextResponse.json(
        { error: "Recommendation ID tidak valid" },
        { status: 400 }
      );
    }

    // Pastikan rekomendasi benar-benar ada
    if (scope === "RECOMMENDATION") {
      const recommendationCheck = await pool.query(
        `
        SELECT id
        FROM public.recommendations
        WHERE id = $1
        LIMIT 1
        `,
        [recommendationId]
      );

      if (recommendationCheck.rowCount === 0) {
        return NextResponse.json(
          { error: "Rekomendasi tidak ditemukan" },
          { status: 404 }
        );
      }
    }

    // Simpan link ke PostgreSQL
    const result = await pool.query(
      `
      INSERT INTO public.document_files (
        recommendation_id,
        source,
        lha_number,
        lha_date,
        file_name,
        file_url,
        file_type,
        file_size,
        document_scope
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        recommendationId,
        source,
        lhaNumber,
        lhaDate,
        fileName,
        fileUrl,
        "LINK",
        null,
        scope,
      ]
    );

    return NextResponse.json(
      {
        message: "Link dokumen berhasil disimpan",
        document: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST documents error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE - Menghapus data dokumen/link
// ==========================================
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const id = Number(body.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "ID dokumen tidak valid" },
        { status: 400 }
      );
    }

    // Cari dokumen berdasarkan ID
    const result = await pool.query(
      `
      SELECT *
      FROM public.document_files
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Dokumen tidak ditemukan" },
        { status: 404 }
      );
    }

    const document = result.rows[0];

    // Hanya hapus file lama jika memang berasal dari Vercel Blob.
    // Link Google Drive atau link eksternal lainnya tidak disentuh.
    try {
      const documentUrl = new URL(document.file_url);

      if (documentUrl.hostname.endsWith(".blob.vercel-storage.com")) {
        await del(document.file_url);
      }
    } catch (error) {
      console.error("Gagal menghapus file Blob lama:", error);
    }

    // Hapus data dari PostgreSQL
    await pool.query(
      `
      DELETE FROM public.document_files
      WHERE id = $1
      `,
      [id]
    );

    return NextResponse.json({
      message: "Link dokumen berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE documents error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
