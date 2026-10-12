import { all, create } from "mathjs";

const math = create(all);

const VARIABEL_DIIZINKAN = [
  "capaian",
  "saldo",
  "tl_belum_tuntas",
  "tl_sudah_tuntas",
];

const FUNGSI_DIIZINKAN = ["min", "max", "abs", "round"];

export function hitungRumusIndeks(
  rumus: string,
  data: Record<string, number>
): number {
  const ekspresi = rumus
    .trim()
    .replace(/^=/, "")
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");

  if (!ekspresi) {
    throw new Error("Rumus tidak boleh kosong.");
  }

  const node = math.parse(ekspresi);

  node.traverse((bagian) => {
    if (bagian.type === "SymbolNode") {
      const nama = bagian.toString();

      const namaVariabel = VARIABEL_DIIZINKAN.includes(nama);
      const namaFungsi = FUNGSI_DIIZINKAN.includes(nama.toLowerCase());

      if (!namaVariabel && !namaFungsi) {
        throw new Error(`Variabel atau fungsi tidak diizinkan: ${nama}`);
      }
    }

    if (bagian.type === "FunctionNode") {
      const teksFungsi = bagian.toString();
      const namaFungsi = teksFungsi.split("(")[0].trim();

      if (!FUNGSI_DIIZINKAN.includes(namaFungsi.toLowerCase())) {
        throw new Error("Fungsi dalam rumus tidak diizinkan.");
      }
    }
  });

  for (const nama of VARIABEL_DIIZINKAN) {
    if (ekspresi.includes(nama) && !Number.isFinite(data[nama])) {
      throw new Error(`Nilai variabel ${nama} tidak valid.`);
    }
  }

  const hasil = math.evaluate(ekspresi, data);

  if (typeof hasil !== "number" || !Number.isFinite(hasil)) {
    throw new Error("Rumus menghasilkan nilai yang tidak valid.");
  }

  return hasil;
}
