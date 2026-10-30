import "server-only";
import { XMLParser, XMLValidator } from "fast-xml-parser";

// Only the test URL supplied by İşNet is supported here. No production fallback.
export const ISNET_ESMM_TEST_URL =
  "https://einvoiceservicetest.isnet.net.tr/InvoiceService/ServiceContract/InvoiceService.svc";
const model = "http://schemas.datacontract.org/2004/07/EInvoice.Service.Model";
const dataModel = `${model}.DataModels`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class IsnetEsmmError extends Error {
  constructor(
    public readonly outcome: "not_sent" | "uncertain" | "rejected",
    message: string,
  ) {
    super(message);
    this.name = "IsnetEsmmError";
  }
}
type Amount = string;
export type EsmmTestLine = {
  productName: string;
  productDescription: string;
  grossAmount: Amount;
  netAmount: Amount;
  payableAmount: Amount;
  stoppageTaxAmount: Amount;
  stoppageTaxRate: Amount;
  stoppageTaxableAmount: Amount;
  totalTaxAmount: Amount;
  vatTaxAmount: Amount;
  vatTaxRate: Amount;
  vatTaxableAmount: Amount;
  witholdingTaxAmount: Amount;
  witholdingTaxCode: string;
  witholdingTaxRate: Amount;
  witholdingTaxableAmount: Amount;
};
export type EsmmTestDraft = {
  // Use the same values for reconciliation after a timeout. Never generate a new identity to retry.
  ettn: string;
  externalDocumentNumber: string;
  documentNumber: string;
  documentDate: string;
  note: string;
  receiver: {
    taxCode: string;
    name: string;
    address: string;
    city: string;
    town: string;
    taxOffice: string;
    email: string;
  };
  lines: EsmmTestLine[];
  grossAmount: Amount;
  payableAmount: Amount;
  totalAmount: Amount;
  totalCollectedVatAmount: Amount;
  totalStoppageAmount: Amount;
  totalTaxAmount: Amount;
  totalVatAmount: Amount;
  totalWitholdingAmount: Amount;
};
const escapeXml = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function tag(name: string, value: string, prefix = "a") {
  return `<${prefix}:${name}>${escapeXml(value)}</${prefix}:${name}>`;
}
function text(value: unknown, label: string, max = 1000) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
  )
    throw new IsnetEsmmError("not_sent", `${label} geçersiz.`);
  return value;
}
function identity(value: string) {
  if (!/^\d{10,11}$/.test(value))
    throw new IsnetEsmmError(
      "not_sent",
      "İşNet test firma VKN/TCKN bilgisi geçersiz.",
    );
  return value;
}
function cents(value: string) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value))
    throw new IsnetEsmmError(
      "not_sent",
      "Tutarlar nokta ayırıcıyla ve en fazla iki ondalıkla verilmelidir.",
    );
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
function validateDraft(d: EsmmTestDraft) {
  if (
    !uuid.test(d.ettn) ||
    !/^SPRINT-TEST-[0-9a-f-]{36}$/i.test(d.externalDocumentNumber)
  )
    throw new IsnetEsmmError(
      "not_sent",
      "Kalıcı test ETTN ve harici belge kodu zorunlu.",
    );
  if (!/^[A-Z0-9]{1,32}$/.test(d.documentNumber))
    throw new IsnetEsmmError(
      "not_sent",
      "Test firmasının yetkili makbuz serisi/numarası gerekli.",
    );
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:00$/.test(d.documentDate) ||
    !Number.isFinite(Date.parse(d.documentDate))
  )
    throw new IsnetEsmmError(
      "not_sent",
      "Test belge tarihi Türkiye saatiyle verilmelidir.",
    );
  identity(d.receiver.taxCode);
  for (const [key, value] of Object.entries(d.receiver)) text(value, key);
  if (
    !d.receiver.name.trim() ||
    !d.receiver.address.trim() ||
    !d.receiver.city.trim() ||
    !d.receiver.town.trim()
  )
    throw new IsnetEsmmError("not_sent", "Test alıcısı adres bilgileri eksik.");
  if (!Array.isArray(d.lines) || !d.lines.length || d.lines.length > 50)
    throw new IsnetEsmmError("not_sent", "1–50 hizmet satırı gerekli.");
  const sum = (key: keyof EsmmTestLine) =>
    d.lines.reduce((n, line) => n + cents(line[key]), 0);
  for (const line of d.lines) {
    if (!text(line.productName, "Hizmet adı").trim())
      throw new IsnetEsmmError("not_sent", "Hizmet adı zorunlu.");
    text(line.productDescription, "Hizmet açıklaması");
    text(line.witholdingTaxCode, "Tevkifat kodu", 30);
    for (const key of Object.keys(line) as (keyof EsmmTestLine)[])
      if (
        !["productName", "productDescription", "witholdingTaxCode"].includes(
          key,
        )
      )
        cents(line[key]);
    if (
      [line.vatTaxRate, line.stoppageTaxRate, line.witholdingTaxRate].some(
        (rate) => cents(rate) > 10000,
      )
    )
      throw new IsnetEsmmError(
        "not_sent",
        "Vergi oranı 0–100 aralığında olmalıdır.",
      );
    if (cents(line.witholdingTaxAmount) > 0 && !line.witholdingTaxCode.trim())
      throw new IsnetEsmmError("not_sent", "Tevkifat kodu zorunlu.");
    if (
      cents(line.grossAmount) +
        cents(line.vatTaxAmount) -
        cents(line.stoppageTaxAmount) -
        cents(line.witholdingTaxAmount) !==
      cents(line.payableAmount)
    )
      throw new IsnetEsmmError(
        "not_sent",
        "Hizmet satırının tahsilat toplamı uyuşmuyor.",
      );
  }
  for (const [total, line] of [
    ["grossAmount", "grossAmount"],
    ["payableAmount", "payableAmount"],
    ["totalAmount", "netAmount"],
    ["totalStoppageAmount", "stoppageTaxAmount"],
    ["totalTaxAmount", "totalTaxAmount"],
    ["totalVatAmount", "vatTaxAmount"],
    ["totalWitholdingAmount", "witholdingTaxAmount"],
  ] as const)
    if (cents(d[total]) !== sum(line))
      throw new IsnetEsmmError(
        "not_sent",
        "Belge toplamları hizmet satırlarıyla uyuşmuyor.",
      );
  if (
    cents(d.totalCollectedVatAmount) !==
      cents(d.totalVatAmount) - cents(d.totalWitholdingAmount) ||
    cents(d.payableAmount) <= 0
  )
    throw new IsnetEsmmError(
      "not_sent",
      "Tahsil edilen KDV veya ödeme tutarı uyuşmuyor.",
    );
  text(d.note, "Not", 2000);
}
export function buildEsmmTestSend(companyTaxCode: string, d: EsmmTestDraft) {
  identity(companyTaxCode);
  validateDraft(d);
  const lineXml = d.lines
    .map(
      (l) =>
        `<b:ESMMDetail>${[
          ["GrossAmount", l.grossAmount],
          ["NetAmount", l.netAmount],
          ["PayableAmount", l.payableAmount],
          ["ProductDescription", l.productDescription],
          ["ProductName", l.productName],
          ["StoppageTaxAmount", l.stoppageTaxAmount],
          ["StoppageTaxRate", l.stoppageTaxRate],
          ["StoppageTaxableAmount", l.stoppageTaxableAmount],
          ["TotalTaxAmount", l.totalTaxAmount],
          ["VatTaxAmount", l.vatTaxAmount],
          ["VatTaxRate", l.vatTaxRate],
          ["VatTaxableAmount", l.vatTaxableAmount],
          ["WitholdingTaxAmount", l.witholdingTaxAmount],
          ["WitholdingTaxCode", l.witholdingTaxCode],
          ["WitholdingTaxRate", l.witholdingTaxRate],
          ["WitholdingTaxableAmount", l.witholdingTaxableAmount],
        ]
          .map(([k, v]) => tag(k, v, "b"))
          .join("")}</b:ESMMDetail>`,
    )
    .join("");
  // WCF DataContract field order and model/data-model namespaces follow the current WSDL.
  const receiver = `<b:Receiver><a:Address>${tag("BoulevardAveneuStreetName", d.receiver.address)}${tag("CityName", d.receiver.city)}${tag("EMail", d.receiver.email)}${tag("TaxOfficeName", d.receiver.taxOffice)}${tag("TownName", d.receiver.town)}</a:Address>${tag("ReceiverName", d.receiver.name)}${tag("ReceiverTaxCode", d.receiver.taxCode)}${tag("RecipientType", "NONE")}${tag("SendingType", "ELEKTRONIK")}</b:Receiver>`;
  return (
    tag("CompanyTaxCode", companyTaxCode) +
    `<a:ESMM xmlns:b="${dataModel}">${tag("CrossRate", "1", "b")}${tag("CurrencyCode", "TRY", "b")}<b:DetailList>${lineXml}</b:DetailList>${tag("DocumentDate", d.documentDate, "b")}${tag("DocumentNumber", d.documentNumber, "b")}${tag("ETTN", d.ettn, "b")}${tag("ExternalDocumentNumber", d.externalDocumentNumber, "b")}${tag("GrossAmount", d.grossAmount, "b")}${tag("Note", d.note, "b")}${tag("PayableAmount", d.payableAmount, "b")}${receiver}${tag("TotalAmount", d.totalAmount, "b")}${tag("TotalCollectedVatAmount", d.totalCollectedVatAmount, "b")}${tag("TotalStoppageAmount", d.totalStoppageAmount, "b")}${tag("TotalTaxAmount", d.totalTaxAmount, "b")}${tag("TotalVatAmount", d.totalVatAmount, "b")}${tag("TotalWitholdingAmount", d.totalWitholdingAmount, "b")}</a:ESMM>`
  );
}
export function buildEsmmTestSearch(
  companyTaxCode: string,
  externalDocumentNumber: string,
  includeFiles = false,
) {
  identity(companyTaxCode);
  if (!/^SPRINT-TEST-[0-9a-f-]{36}$/i.test(externalDocumentNumber))
    throw new IsnetEsmmError(
      "not_sent",
      "Test sorgusu kalıcı harici belge koduyla sınırlandırılmalıdır.",
    );
  return (
    tag("CompanyTaxCode", companyTaxCode) +
    tag("ExternalDocumentNumber", externalDocumentNumber) +
    `<a:PagingRequest>${tag("PageNumber", "1")}${tag("RecordsPerPage", "2")}</a:PagingRequest><a:ResultSet xmlns:b="${dataModel}">${tag("IsDetailsIncluded", "true", "b")}${tag("IsPDFIncluded", String(includeFiles), "b")}${tag("IsXMLIncluded", String(includeFiles), "b")}</a:ResultSet>`
  );
}
export function parseIsnetEsmmReply(
  xml: string,
  operation: "HealthCheck" | "SendESMM" | "SearchESMM",
): Record<string, any> {
  if (
    xml.length > 12_000_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new IsnetEsmmError(
      "uncertain",
      "İşNet yanıtı doğrulanamadı. Yeniden belge göndermeden önce aynı harici kodla sorgulayın.",
    );
  const p = new XMLParser({
    removeNSPrefix: true,
    parseTagValue: false,
    ignoreAttributes: true,
    processEntities: false,
  });
  const envelope = p.parse(xml)?.Envelope;
  const body = envelope?.Body;
  if (body?.Fault)
    throw new IsnetEsmmError(
      "uncertain",
      "İşNet servis hatası döndürdü. Aynı harici kodla durum doğrulanmalı.",
    );
  const value = body?.[`${operation}Response`]?.[`${operation}Result`];
  if (operation === "HealthCheck" && value === "true") return { healthy: true };
  if (!value || typeof value !== "object")
    throw new IsnetEsmmError("uncertain", "İşNet işlem yanıtı eksik.");
  if (value.Result !== "Success")
    throw new IsnetEsmmError(
      "rejected",
      "İşNet işlemi kabul etmedi. Firma yetkisi ve servis yanıtı sağlayıcıyla kontrol edilmeli.",
    );
  return value;
}
export class IsnetEsmmTestClient {
  constructor(
    private readonly companyTaxCode: string,
    private readonly transport: typeof fetch = fetch,
  ) {
    identity(companyTaxCode);
  }
  private async call(
    operation: "HealthCheck" | "SendESMM" | "SearchESMM",
    request: string,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const inner =
      operation === "HealthCheck"
        ? ""
        : `<request xmlns:a="${model}" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${request}</request>`;
    const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${operation} xmlns="http://tempuri.org/">${inner}</${operation}></s:Body></s:Envelope>`;
    try {
      const response = await this.transport(ISNET_ESMM_TEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `"http://tempuri.org/IInvoiceService/${operation}"`,
        },
        body,
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok)
        throw new IsnetEsmmError(
          "uncertain",
          "İşNet HTTP yanıtı başarısız. Yeni makbuz göndermeden önce durum sorgulanmalı.",
        );
      const length = Number(response.headers.get("content-length") || 0);
      if (length > 12_000_000)
        throw new IsnetEsmmError(
          "uncertain",
          "İşNet yanıtı boyut sınırını aşıyor.",
        );
      return parseIsnetEsmmReply(await response.text(), operation);
    } catch (error) {
      if (error instanceof IsnetEsmmError) throw error;
      throw new IsnetEsmmError(
        "uncertain",
        "İşNet yanıtı alınamadı. Otomatik tekrar gönderimi yapılmadı; aynı harici kodla sorgulayın.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  health() {
    return this.call("HealthCheck", "");
  }
  async send(draft: EsmmTestDraft) {
    const result = await this.call(
      "SendESMM",
      buildEsmmTestSend(this.companyTaxCode, draft),
    );
    if (
      result.Ettn !== draft.ettn ||
      !result.DocumentNumber ||
      result.ExternalESMMCode !== draft.externalDocumentNumber
    )
      throw new IsnetEsmmError(
        "uncertain",
        "Gönderim kimliği doğrulanamadı. Aynı harici kodla sorgulayın.",
      );
    return {
      ettn: String(result.Ettn),
      documentNumber: String(result.DocumentNumber),
      externalCode: String(result.ExternalESMMCode),
    };
  }
  async search(externalCode: string, includeFiles = false) {
    const result = await this.call(
      "SearchESMM",
      buildEsmmTestSearch(this.companyTaxCode, externalCode, includeFiles),
    );
    const raw = result.ESMM?.ESMM;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (rows.some((row: any) => row.ExternalDocumentNumber !== externalCode))
      throw new IsnetEsmmError(
        "uncertain",
        "İşNet sorgusu farklı bir harici belge kodu döndürdü.",
      );
    return rows as Record<string, any>[];
  }
}
