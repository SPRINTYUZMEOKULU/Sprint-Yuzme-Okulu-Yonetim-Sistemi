"use client";

import { useEffect } from "react";

export default function PaymentCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Ödeme Merkezi istemci hatası:", error);
  }, [error]);

  return (
    <main style={{minHeight:"70vh",display:"grid",placeItems:"center",padding:"24px",background:"#f4f7fb"}}>
      <section style={{width:"min(620px,100%)",background:"#fff",border:"1px solid #dbe5f1",borderRadius:"22px",padding:"28px",boxShadow:"0 18px 50px rgba(15,23,42,.08)",color:"#10213a"}}>
        <div style={{fontSize:"12px",fontWeight:900,letterSpacing:".08em",color:"#2563eb",marginBottom:"8px"}}>SPRİNTOS · ÖDEME MERKEZİ</div>
        <h1 style={{fontSize:"24px",margin:"0 0 10px"}}>Ekran yenilenirken bir sorun oluştu</h1>
        <p style={{margin:"0 0 18px",color:"#64748b",lineHeight:1.6}}>Ödeme işlemi sunucuda tamamlanmış olabilir. Aynı ödemeyi tekrar girmeden önce ekranı yeniden yükleyip ödeme geçmişini kontrol edin.</p>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
          <button type="button" onClick={() => reset()} style={{border:0,borderRadius:"12px",background:"#156ff5",color:"#fff",padding:"12px 16px",fontWeight:800,cursor:"pointer"}}>Tekrar Dene</button>
          <button type="button" onClick={() => window.location.replace("/odemeler")} style={{border:"1px solid #dbe5f1",borderRadius:"12px",background:"#fff",color:"#10213a",padding:"12px 16px",fontWeight:800,cursor:"pointer"}}>Ödeme Merkezini Yenile</button>
        </div>
      </section>
    </main>
  );
}
