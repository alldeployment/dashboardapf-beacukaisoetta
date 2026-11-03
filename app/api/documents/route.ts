import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { pool } from "@/lib/db";

const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// ==========================================
// GET - Mengambil daftar dokumen
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
// POST - Upload dokumen
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");
    const source = String(formData.get("source") || "");
    const lhaNumber = String(formData.get("lhaNumber") || "");

    const lhaDateValue = formData.get("lhaDate");
    const lhaDate = lhaDateValue ? String(lhaDateValue) : null;

    const scope = String(formData.get("documentScope") || "");

    const recommendationIdValue = formData.get("recommendationId");

    const recommendationId = recommendationIdValue
      ? Number(recommendationIdValue)
      : null;

    // Validasi file
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File dokumen wajib dipilih" },
        { status: 400 }
      );
    }

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

    // Validasi ukuran file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 20 MB" },
        { status: 400 }
      );
    }

    // Validasi ekstensi
    const originalName = file.name;
    const extension = originalName.split(".").pop()?.toLowerCase();

    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        {
          error:
            "Format file tidak diperbolehkan. Gunakan PDF, DOC, DOCX, XLS, XLSX, PPT, atau PPTX.",
        },
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

    // Upload file ke Vercel Blob
    const blob = await put(`documents/${Date.now()}-${originalName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "application/octet-stream",
    });

    // Simpan metadata dokumen ke PostgreSQL
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
        originalName,
        blob.url,
        extension,
        file.size,
        scope,
      ]
    );

    return NextResponse.json(
      {
        message: "Dokumen berhasil diupload",
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
// DELETE - Menghapus dokumen
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

    // Hapus file dari Vercel Blob
    await del(document.file_url);

    // Hapus metadata dari PostgreSQL
    await pool.query(
      `
      DELETE FROM public.document_files
      WHERE id = $1
      `,
      [id]
    );

    return NextResponse.json({
      message: "Dokumen berhasil dihapus",
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
