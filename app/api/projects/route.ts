import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        project_name,
        project_year,
        description,
        status,
        created_at
      FROM public.projects
      ORDER BY project_year DESC, id DESC
    `);

    return NextResponse.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("GET PROJECTS ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal mengambil data proyek.",
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan database.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const projectName = String(body.project_name ?? "").trim();
    const projectYear = Number(body.project_year);
    const description = String(body.description ?? "").trim();
    const status = String(body.status ?? "BERJALAN").trim();

    if (
      !projectName ||
      !Number.isInteger(projectYear) ||
      projectYear < 1900 ||
      projectYear > 9999
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Nama proyek dan tahun proyek wajib diisi dengan benar.",
        },
        { status: 400 }
      );
    }

    if (!["BERJALAN", "SELESAI", "DITUNDA"].includes(status)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Status proyek tidak valid.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      INSERT INTO public.projects (
        project_name,
        project_year,
        description,
        status
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        project_name,
        project_year,
        description,
        status,
        created_at
      `,
      [projectName, projectYear, description || null, status]
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Proyek berhasil ditambahkan.",
        data: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST PROJECT ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Gagal menambahkan proyek.",
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan database.",
      },
      { status: 500 }
    );
  }
}
