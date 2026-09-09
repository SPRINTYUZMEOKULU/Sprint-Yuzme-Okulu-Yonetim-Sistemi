import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { SPRINT_MESSAGE_TEMPLATE_MAP } from "@/lib/messaging/sprint-message-catalog";
import PaymentActions from "./payment-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function normalizeText(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function isAdultCourse(value: unknown) {
  const text = normalizeText(value);
  return text.includes("yetişkin") || text.includes("yetiskin") || text.includes("adult") || text.includes("master");
}

export default async function PaymentInformationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const studentId = typeof params.studentId === "string" ? params.studentId : "";

  const profile = await requireProfile(["owner","admin","branch_manager","registration_staff","accounting"]);
  const organizationId = profile.organization_id;
  const template = SPRINT_MESSAGE_TEMPLATE_MAP.bank_info;
  const message = template?.body || "Ödeme bilgisi şablonu bulunamadı.";
  const iban = message.match(/TR(?:\s*\d){24}/i)?.[0] || "";

  let studentName = "";
  let recipientPhone = "";

  if (organizationId && studentId) {
    const supabase = await createClient();
    const { data: student } = await supabase
      .from("students")
      .select("id,first_name,last_name,phone,guardian_phone,preferred_group_id")
      .eq("organization_id", organizationId)
      .eq("id", studentId)
      .maybeSingle();

    if (student) {
      studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();

      let courseType = "";
      if (student.preferred_group_id) {
        const { data: group } = await supabase
          .from("training_groups")
          .select("course_type")
          .eq("organization_id", organizationId)
          .eq("id", student.preferred_group_id)
          .maybeSingle();
        courseType = group?.course_type || "";
      }

      recipientPhone = isAdultCourse(courseType)
        ? (student.phone || student.guardian_phone || "")
        : (student.guardian_phone || student.phone || "");
    }
  }

  return (
    <main style={{maxWidth:940,margin:"0 auto",padding:"28px 16px 110px"}}>
      <section style={{background:"#fff",border:"1px solid #d8e5f1",borderRadius:24,overflow:"hidden",boxShadow:"0 18px 48px rgba(8,45,82,.10)"}}>
        <header style={{padding:"24px 24px 20px",background:"linear-gradient(135deg,#082a4b,#0b5f9d)",color:"white"}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#9ed4ff"}}>SPRİNT YÜZME OKULU · ÖDEME MERKEZİ</div>
          <h1 style={{margin:"7px 0 5px",fontSize:"clamp(26px,5vw,36px)"}}>Ödeme Bilgileri</h1>
          <p style={{margin:0,color:"#dceeff"}}>{studentName ? `${studentName} · ` : ""}IBAN, QR ve WhatsApp gönderimi tek ekranda</p>
        </header>

        <div style={{padding:22}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,padding:6,borderRadius:14,background:"#f1f6fb",marginBottom:18}}>
            <div style={{padding:"10px 12px",borderRadius:10,background:"#fff",color:"#0b63c7",fontSize:12,fontWeight:900,textAlign:"center",boxShadow:"0 3px 10px rgba(8,45,82,.07)"}}>IBAN / QR</div>
            <Link href={studentId ? `/ogrenciler/${studentId}` : "/odemeler"} style={{padding:"10px 12px",borderRadius:10,color:"#294b6b",fontSize:12,fontWeight:800,textAlign:"center",textDecoration:"none"}}>Ödeme Kaydı</Link>
            <Link href="/hazir-mesajlar" style={{padding:"10px 12px",borderRadius:10,color:"#294b6b",fontSize:12,fontWeight:800,textAlign:"center",textDecoration:"none"}}>Hazır Mesajlar</Link>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.55fr) minmax(180px,.7fr)",gap:14,alignItems:"stretch"}} className="paymentInfoGrid">
            <section style={{padding:18,borderRadius:18,border:"1px solid #d8e5f1",background:"linear-gradient(180deg,#fbfdff,#f5f9fd)"}}>
              <div style={{fontSize:11,fontWeight:900,letterSpacing:".08em",color:"#71869a"}}>SPRİNT YÜZME OKULU</div>
              <h2 style={{margin:"5px 0 14px",fontSize:18,color:"#0c3159"}}>VakıfBank</h2>
              <div style={{fontSize:12,color:"#71869a",fontWeight:800,marginBottom:6}}>IBAN</div>
              <div style={{fontSize:"clamp(16px,3.5vw,21px)",fontWeight:900,color:"#123a5d",letterSpacing:".02em",wordBreak:"break-word"}}>{iban || "IBAN şablonda bulunamadı"}</div>
              <div style={{marginTop:14,padding:"11px 12px",borderRadius:12,background:"#eef6ff",color:"#315b82",fontSize:12,lineHeight:1.45}}>
                Açıklama yazmanıza gerek yok. Ödeme sonrası dekont paylaşımı isteğe bağlıdır.
              </div>
            </section>

            <section style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:9,padding:14,borderRadius:18,border:"1px solid #d8e5f1",background:"#fff"}}>
              <img src="/payment/vakifbank-qr.jpg" alt="VakıfBank ödeme QR kodu" style={{display:"block",width:"100%",maxWidth:190,height:"auto",borderRadius:12,border:"1px solid #e0e8ef"}} />
              <span style={{fontSize:11,color:"#6f8498",fontWeight:800,textAlign:"center"}}>Orijinal banka QR görseli</span>
            </section>
          </div>

          <PaymentActions
            message={message}
            qrUrl="/payment/vakifbank-qr.jpg"
            recipientPhone={recipientPhone}
            studentName={studentName}
          />

          <details style={{marginTop:18,borderTop:"1px solid #e5edf4",paddingTop:16}}>
            <summary style={{cursor:"pointer",fontSize:12,fontWeight:900,color:"#315b82"}}>Hazır ödeme mesajını görüntüle</summary>
            <pre style={{whiteSpace:"pre-wrap",font:"13px/1.55 system-ui",padding:16,borderRadius:14,background:"#f7f9fb",color:"#23384d",border:"1px solid #e1e8ef",marginTop:12}}>{message}</pre>
          </details>

          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}>
            <Link href="/hazir-mesajlar" style={{padding:"11px 14px",borderRadius:12,background:"#edf4fa",color:"#0c3159",fontWeight:800,textDecoration:"none",border:"1px solid #d6e3ee",fontSize:12}}>Hazır Mesajlar Merkezi</Link>
            {studentId ? (
              <Link href={`/ogrenciler/${studentId}`} style={{padding:"11px 14px",borderRadius:12,background:"#fff",color:"#0c3159",fontWeight:800,textDecoration:"none",border:"1px solid #d6e3ee",fontSize:12}}>Kursiyer Dosyasına Dön</Link>
            ) : null}
          </div>
        </div>
      </section>

      <style>{`@media (max-width:680px){.paymentInfoGrid{grid-template-columns:1fr!important}}`}</style>
    </main>
  );
}
