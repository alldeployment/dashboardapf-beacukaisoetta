const API_URL = "https://lifestyle-bits-reserves-faces.trycloudflare.com/api";

export type DashboardData = {
  total: number;
  belumTl: number;
  sudahTl: number;
  sudahTuntas: number;
  masukSaldo: number;
  belumSaldo: number;
  persentaseSaldo: number;
  persentaseBelumSaldo: number;
  capaian: number;

  bpk: {
    total: number;
    masukSaldo: number;
    belumSaldo: number;
    keuangan: number;
    bukanKeuangan: number;
    persentaseSaldo: number;
  };

  itjen: {
    total: number;
    selesai: number;
    proses: number;
    belum: number;
  };
};

export type Recommendation = {
  id: number;
  source: string;
  category: string;
  lha_number: string;
  lha_date: string;
  recommendation_count: number;
  follow_up_status: string;
  saldo_status: string;
  description: string | null;
};

type ApiResponse<T> = {
  ok: boolean;
  data: T;
  message?: string;
};

/* =========================
   LOGIN
========================= */

export type LoginResponse = {
  id: number;
  username: string;
  name: string | null;
  role: string;
};

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      message?: string;
      data?: LoginResponse;
    };

    if (!response.ok || !json.ok || !json.data) {
      throw new Error(json.message || "Username atau password salah.");
    }

    return json.data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Tidak dapat terhubung ke server. Pastikan backend sedang berjalan."
      );
    }

    throw error;
  }
}

/* =========================
   DASHBOARD
========================= */

export async function getDashboardSummary(): Promise<DashboardData> {
  const response = await fetch(`${API_URL}/dashboard/summary`);

  if (!response.ok) {
    throw new Error(`Gagal mengambil dashboard: ${response.status}`);
  }

  const json = (await response.json()) as ApiResponse<DashboardData>;

  if (!json.ok) {
    throw new Error(json.message || "Gagal mengambil data dashboard");
  }

  return json.data;
}

/* =========================
   RECOMMENDATIONS
========================= */

export async function getRecommendations(): Promise<Recommendation[]> {
  const response = await fetch(`${API_URL}/recommendations`);

  if (!response.ok) {
    throw new Error(`Gagal mengambil rekomendasi: ${response.status}`);
  }

  const json = (await response.json()) as ApiResponse<Recommendation[]>;

  if (!json.ok) {
    throw new Error(json.message || "Gagal mengambil data rekomendasi");
  }

  return json.data;
}
