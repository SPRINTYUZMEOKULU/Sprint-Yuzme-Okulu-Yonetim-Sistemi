import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { SPRINT_MESSAGE_TEMPLATE_MAP } from "@/lib/messaging/sprint-message-catalog";

export const dynamic = "force-dynamic";

export default async function PaymentInformationPage() {
  await requireProfile(["owner","admin","branch_manager","registration_staff","accounting"]);
  const template = SPRINT_MESSAGE_TEMPLATE_MAP.bank_info;

  return (
    <main style={{maxWidth:900,margin:"0 auto",padding:"28px 16px 80px"}}>
      <section style={{background:"#fff",border:"1px solid #dbe6f0",borderRadius:22,overflow:"hidden",boxShadow:"0 16px 42px rgba(8,45,82,.10)"}}>
        <header style={{padding:24,background:"linear-gradient(135deg,#082a4b,#0b5f9d)",color:"white"}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#9ed4ff"}}>SPRİNT YÜZME OKULU</div>
          <h1 style={{margin:"7px 0 5px"}}>IBAN & QR Ödeme Bilgileri</h1>
          <p style={{margin:0,color:"#dceeff"}}>Kursiyere gönderilecek ödeme bilgisi merkezi hazır mesaj şablonundan yönetilir.</p>
        </header>
        <div style={{padding:22}}>
          <h2 style={{marginTop:0,fontSize:17,color:"#0c3159"}}>Hazır Mesaj</h2>
          <pre style={{whiteSpace:"pre-wrap",font:"14px/1.55 system-ui",padding:18,borderRadius:14,background:"#f7f9fb",color:"#23384d"}}>{template?.body || "Ödeme bilgisi şablonu bulunamadı."}</pre>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
            <Link href="/hazir-mesajlar" style={{padding:"12px 16px",borderRadius:12,background:"#0a5da8",color:"white",fontWeight:800,textDecoration:"none"}}>Hazır Mesajlarda Aç</Link>
            <a href="/payment/vakifbank-qr.jpg" target="_blank" rel="noreferrer" style={{padding:"12px 16px",borderRadius:12,background:"#edf4fa",color:"#0c3159",fontWeight:800,textDecoration:"none",border:"1px solid #d6e3ee"}}>QR Görselini Aç</a>
          </div>
        </div>
      </section>
    </main>
  );
}
