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
    <main style={{maxWidth:900,margin:"0 auto",padding:"28px 16px 110px"}}>
      <section style={{background:"#fff",border:"1px solid #dbe6f0",borderRadius:22,overflow:"hidden",boxShadow:"0 16px 42px rgba(8,45,82,.10)"}}>
        <header style={{padding:24,background:"linear-gradient(135deg,#082a4b,#0b5f9d)",color:"white"}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#9ed4ff"}}>SPRİNT YÜZME OKULU · ÖDEME MERKEZİ</div>
          <h1 style={{margin:"7px 0 5px"}}>Ödeme Bilgileri</h1>
          <p style={{margin:0,color:"#dceeff"}}>{studentName ? `${studentName} · ` : ""}IBAN, QR ve WhatsApp gönderimi tek ekranda</p>
        </header>

        <div style={{padding:22}}>
          <nav style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6,padding:7,borderRadius:15,background:"#eef4f9",marginBottom:18}}>
            <span style={{padding:"11px 8px",borderRadius:11,background:"#fff",color:"#0a5da8",fontWeight:900,textAlign:"center",boxShadow:"0 4px 12px rgba(12,49,89,.06)"}}>IBAN / QR</span>
            {studentId ? (
              <Link href={`/ogrenciler/${studentId}?payment=history`} style={{padding:"11px 8px",borderRadius:11,color:"#244b6f",fontWeight:800,textAlign:"center",textDecoration:"none"}}>Ödeme Kaydı</Link>
            ) : (
              <span style={{padding:"11px 8px",borderRadius:11,color:"#8295a7",fontWeight:800,textAlign:"center"}}>Ödeme Kaydı</span>
            )}
            <Link href="/hazir-mesajlar" style={{padding:"11px 8px",borderRadius:11,color:"#244b6f",fontWeight:800,textAlign:"center",textDecoration:"none"}}>Hazır Mesajlar</Link>
          </nav>

          <section style={{padding:18,border:"1px solid #d9e5ef",borderRadius:16,background:"#fbfdff"}}>
            <div style={{fontSize:11,fontWeight:900,letterSpacing:".08em",color:"#71869a"}}>SPRİNT YÜZME OKULU</div>
            <h2 style={{margin:"6px 0 14px",fontSize:22,color:"#0c3159"}}>VakıfBank</h2>
            <div style={{fontSize:12,fontWeight:900,color:"#71869a"}}>IBAN</div>
            <div style={{marginTop:6,fontSize:19,fontWeight:900,color:"#123a5d",wordBreak:"break-word"}}>TR14 0001 5001 5800 7357 4815 06</div>
            <div style={{marginTop:15,padding:14,borderRadius:12,background:"#edf5fb",color:"#315f86",fontSize:13,lineHeight:1.45}}>Açıklama yazmanıza gerek yok. Ödeme sonrası dekont paylaşımı isteğe bağlıdır.</div>
          </section>

          <section style={{marginTop:16,padding:18,border:"1px solid #d9e5ef",borderRadius:16,textAlign:"center",background:"#fff"}}>
            <img src="/payment/vakifbank-qr.jpg" alt="VakıfBank QR ödeme görseli" style={{display:"block",width:"min(360px,100%)",height:"auto",margin:"0 auto",borderRadius:12}} />
            <div style={{marginTop:9,fontSize:12,fontWeight:800,color:"#70859a"}}>Orijinal banka QR görseli</div>
          </section>

          <PaymentActions
            message={message}
            qrUrl="/payment/vakifbank-qr.jpg"
            recipientPhone={recipientPhone}
            studentName={studentName}
          />

          <details style={{marginTop:18,paddingTop:16,borderTop:"1px solid #e5edf4"}}>
            <summary style={{cursor:"pointer",fontSize:12,fontWeight:900,color:"#315f86"}}>Hazır ödeme mesajını görüntüle</summary>
            <pre style={{whiteSpace:"pre-wrap",font:"13px/1.55 system-ui",padding:16,borderRadius:14,background:"#f7f9fb",color:"#23384d",border:"1px solid #e1e8ef",marginTop:12}}>{message}</pre>
          </details>

          {studentId ? (
            <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #e5edf4"}}>
              <Link href={`/ogrenciler/${studentId}`} style={{display:"inline-flex",padding:"11px 14px",borderRadius:12,background:"#fff",color:"#0c3159",fontWeight:800,textDecoration:"none",border:"1px solid #d6e3ee",fontSize:12}}>Kursiyer Dosyasına Dön</Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
