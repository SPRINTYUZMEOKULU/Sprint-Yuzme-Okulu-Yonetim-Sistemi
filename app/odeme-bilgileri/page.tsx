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
          <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#9ed4ff"}}>SPRİNT YÜZME OKULU</div>
          <h1 style={{margin:"7px 0 5px"}}>IBAN & QR Ödeme Bilgileri</h1>
          <p style={{margin:0,color:"#dceeff"}}>IBAN mesajını kopyalayın, WhatsApp'ta gönderin veya banka QR görselini doğrudan paylaşın.</p>
        </header>

        <div style={{padding:22}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:11,fontWeight:900,letterSpacing:".08em",color:"#71869a"}}>VAKIFBANK</div>
              <h2 style={{margin:"4px 0 0",fontSize:17,color:"#0c3159"}}>Hazır Ödeme Mesajı</h2>
            </div>
            <span style={{padding:"7px 10px",borderRadius:999,background:"#edf6fb",color:"#0a5da8",fontSize:11,fontWeight:900}}>QR AKTİF</span>
          </div>

          <pre style={{whiteSpace:"pre-wrap",font:"14px/1.55 system-ui",padding:18,borderRadius:14,background:"#f7f9fb",color:"#23384d",border:"1px solid #e1e8ef",marginTop:14}}>{message}</pre>

          <PaymentActions
            message={message}
            qrUrl="/payment/vakifbank-qr.jpg"
            recipientPhone={recipientPhone}
            studentName={studentName}
          />

          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18,paddingTop:16,borderTop:"1px solid #e5edf4"}}>
            <Link href="/hazir-mesajlar" style={{padding:"11px 14px",borderRadius:12,background:"#edf4fa",color:"#0c3159",fontWeight:800,textDecoration:"none",border:"1px solid #d6e3ee",fontSize:12}}>Hazır Mesajlar Merkezi</Link>
            {studentId ? (
              <Link href={`/ogrenciler/${studentId}`} style={{padding:"11px 14px",borderRadius:12,background:"#fff",color:"#0c3159",fontWeight:800,textDecoration:"none",border:"1px solid #d6e3ee",fontSize:12}}>Kursiyer Dosyasına Dön</Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
