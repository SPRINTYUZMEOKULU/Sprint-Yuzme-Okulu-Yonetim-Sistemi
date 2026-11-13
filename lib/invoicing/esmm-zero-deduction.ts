import type { EsmmTestLine } from "./isnet-esmm-test";

export type EsmmAmountBasis = "collected" | "gross";
export type EsmmZeroDeductionProfile = {
  vatRate: string;
  stoppageRate: string;
  withholdingRate: string;
};

function minorUnits(value: string, maxDigits: number): number {
  if (typeof value !== "string") throw new Error("Tutar ve oranlar açıkça belirtilmelidir.");
  let normalized = value.trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized)) normalized = normalized.replaceAll(".", "");
  normalized = normalized.replace(",", ".");
  if (!new RegExp(`^\\d{1,${maxDigits}}(?:\\.\\d{1,2})?$`).test(normalized)) throw new Error("En fazla iki ondalıkla geçerli bir tutar veya oran yazınız.");
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
const decimal = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
const roundedRatio = (amount: number, numerator: number, denominator: number) => Math.floor((amount * numerator + denominator / 2) / denominator);

/** Explicit zero-deduction scenario only. No tax profile is selected for a real document. */
export function calculateZeroDeductionEsmm(
  amount: string,
  basis: EsmmAmountBasis,
  profile: EsmmZeroDeductionProfile,
): Omit<EsmmTestLine, "productName" | "productDescription"> {
  if (basis !== "collected" && basis !== "gross") throw new Error("Tutarın tahsilat mı brüt hizmet bedeli mi olduğu seçilmelidir.");
  const vat = minorUnits(profile.vatRate, 3);
  const stoppage = minorUnits(profile.stoppageRate, 3);
  const withholding = minorUnits(profile.withholdingRate, 3);
  if ([vat, stoppage, withholding].some(rate => rate > 10000)) throw new Error("Vergi oranı 0–100 aralığında olmalıdır.");
  if (stoppage !== 0 || withholding !== 0) throw new Error("Bu önizleme yalnızca stopaj ve tevkifat oranı sıfır olan profili destekler.");
  const input = minorUnits(amount, 9);
  if (input <= 0) throw new Error("Tutar sıfırdan büyük olmalıdır.");
  const gross = basis === "gross" ? input : roundedRatio(input, 10000, 10000 + vat);
  const tax = roundedRatio(gross, vat, 10000);
  const collected = gross + tax;
  if (gross <= 0 || (basis === "collected" && collected !== input)) throw new Error("Bu tahsilat tutarı için kuruş bazında uyumlu brüt/KDV dağılımı bulunamadı. Tutarı kontrol ediniz.");
  return {
    grossAmount: decimal(gross), netAmount: decimal(gross), payableAmount: decimal(collected),
    vatTaxRate: decimal(vat), vatTaxableAmount: decimal(gross), vatTaxAmount: decimal(tax),
    stoppageTaxRate: "0.00", stoppageTaxableAmount: decimal(gross), stoppageTaxAmount: "0.00",
    witholdingTaxRate: "0.00", witholdingTaxableAmount: "0.00", witholdingTaxAmount: "0.00", witholdingTaxCode: "",
    totalTaxAmount: decimal(tax),
  };
}
