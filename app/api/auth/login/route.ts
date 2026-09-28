import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "Username dan password wajib diisi.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        password_hash,
        name,
        role
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Username atau password salah.",
        },
        { status: 401 }
      );
    }

    const admin = result.rows[0];

    const passwordValid = await bcrypt.compare(password, admin.password_hash);

    if (!passwordValid) {
      return NextResponse.json(
        {
          ok: false,
          message: "Username atau password salah.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Login berhasil.",
      data: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
