"use client";

export default function PaymentInfoShortcut({
  studentId,
  inFinancePanel = false,
}: {
  studentId: string;
  inFinancePanel?: boolean;
}) {
  return (
    <a
      href={`/odeme-bilgileri?studentId=${encodeURIComponent(studentId)}&mode=secure`}
      className={inFinancePanel ? "securePaymentFinance" : "securePaymentInline"}
      aria-label="Güvenli Ödeme bilgilerini gönder"
    >
      <span className="securePaymentInlineIcon" aria-hidden="true">✓</span>
      <span className="securePaymentInlineText">
        <b>Güvenli Ödeme</b>
        <small>Belge bilgisi + ödeme linki</small>
      </span>
      <style jsx>{`
      .securePaymentInline,.securePaymentFinance{box-sizing:border-box;min-height:58px;display:flex;align-items:center;justify-content:center;gap:10px;padding:11px 16px;border-radius:18px;border:1px solid #a9dfc1;background:linear-gradient(135deg,#effbf4,#e3f7ec);color:#08783e;text-decoration:none!important;font-family:inherit;font-weight:800;box-shadow:0 7px 18px rgba(17,130,73,.08);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
      .securePaymentInline:hover,.securePaymentFinance:hover{transform:translateY(-1px);border-color:#70c899;box-shadow:0 10px 22px rgba(17,130,73,.14)}
      .securePaymentInlineIcon{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:10px;background:#0a9b53;color:#fff;font-size:17px;font-weight:900}
      .securePaymentInlineText{display:flex;flex-direction:column;align-items:flex-start;line-height:1.08}
      .securePaymentInlineText b{font-size:14px}.securePaymentInlineText small{margin-top:4px;color:#56856c;font-size:10px;font-weight:700}
      .securePaymentFinance{grid-column:1/-1;background:linear-gradient(135deg,#effbf4,#e3f7ec)!important;color:#08783e!important}
      @media(max-width:720px){.securePaymentInline{width:100%;min-height:58px}.securePaymentFinance{grid-column:1/-1}}
    `}</style>
    </a>
  );
}
