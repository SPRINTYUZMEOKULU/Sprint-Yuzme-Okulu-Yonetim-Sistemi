import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { SPRINT_MESSAGE_TEMPLATE_MAP } from "@/lib/messaging/sprint-message-catalog";
import PaymentActions from "./payment-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type PhoneCandidate = { phone: string; label: string; source: string };

function normalizeText(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function isAdultCourse(value: unknown) {
  const text = normalizeText(value);
  return text.includes("yetişkin") || text.includes("yetiskin") || text.includes("adult") || text.includes("master");
}

function phoneKey(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

function addCandidate(list: PhoneCandidate[], phone: unknown, label: string, source: string) {
  const normalized = phoneKey(phone);
  if (!normalized || normalized.length < 10) return;
  if (list.some((item) => phoneKey(item.phone) === normalized)) return;
  list.push({ phone: String(phone), label, source });
}

export default async function PaymentInformationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const studentId = typeof params.studentId === "string" ? params.studentId : "";

  const profile = await requireProfile(["owner","admin","branch_manager","registration_staff","accounting"]);
  const organizationId = profile.organization_id;
  const template = SPRINT_MESSAGE_TEMPLATE_MAP.bank_info;
  const message = template?.body || "Ödeme bilgisi şablonu bulunamadı.";

  let studentName = "";
  let phoneCandidates: PhoneCandidate[] = [];
  let lastSentAt = "";

  if (organizationId && studentId) {
    const supabase = await createClient();
    const [{ data: student }, { data: latestMessage }] = await Promise.all([
      supabase
        .from("students")
        .select("id,first_name,last_name,birth_date,phone,guardian_name,guardian_phone,preferred_group_id")
        .eq("organization_id", organizationId)
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("message_logs")
        .select("sent_at,prepared_at,status")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("template_key", "bank_info")
        .eq("status", "sent")
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ]);

    lastSentAt = latestMessage?.sent_at || latestMessage?.prepared_at || "";

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

      const adult = isAdultCourse(courseType);
      if (adult) {
        addCandidate(phoneCandidates, student.phone, "Kursiyer telefonu", "Öğrenci kaydı");
        addCandidate(phoneCandidates, student.guardian_phone, student.guardian_name ? `${student.guardian_name} · veli` : "Veli telefonu", "Öğrenci kaydı");
      } else {
        addCandidate(phoneCandidates, student.guardian_phone, student.guardian_name ? `${student.guardian_name} · veli` : "Veli telefonu", "Öğrenci kaydı");
        addCandidate(phoneCandidates, student.phone, "Kursiyer telefonu", "Öğrenci kaydı");
      }

      const [{ data: guardianLinks }, { data: preRegistrations }, { data: duplicateStudents }] = await Promise.all([
        supabase
          .from("guardian_students")
          .select("guardian_id,is_primary,is_payment_contact,receives_messages")
          .eq("student_id", studentId)
          .order("is_payment_contact", { ascending: false })
          .order("is_primary", { ascending: false }),
        supabase
          .from("pre_registrations")
          .select("guardian_full_name,phone,whatsapp_phone")
          .eq("organization_id", organizationId)
          .eq("converted_student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("students")
          .select("id,first_name,last_name,phone,guardian_name,guardian_phone,birth_date")
          .eq("organization_id", organizationId)
          .ilike("first_name", student.first_name || "")
          .ilike("last_name", student.last_name || "")
          .neq("id", studentId)
          .limit(8),
      ]);

      const guardianIds = (guardianLinks || []).map((link: any) => link.guardian_id).filter(Boolean);
      if (guardianIds.length) {
        const { data: guardians } = await supabase
          .from("guardians")
          .select("id,full_name,phone,is_active")
          .eq("organization_id", organizationId)
          .in("id", guardianIds);
        const guardianMap = new Map((guardians || []).map((g: any) => [g.id, g]));
        for (const link of guardianLinks || []) {
          const guardian: any = guardianMap.get((link as any).guardian_id);
          if (!guardian || guardian.is_active === false) continue;
          const role = (link as any).is_payment_contact ? "ödeme yetkilisi" : (link as any).is_primary ? "birincil veli" : "bağlı veli";
          addCandidate(phoneCandidates, guardian.phone, `${guardian.full_name || "Veli"} · ${role}`, "Veli merkezi");
        }
      }

      for (const pre of preRegistrations || []) {
        const name = (pre as any).guardian_full_name || "Ön kayıt iletişimi";
        addCandidate(phoneCandidates, (pre as any).whatsapp_phone, `${name} · WhatsApp`, "Ön kayıt");
        addCandidate(phoneCandidates, (pre as any).phone, `${name} · telefon`, "Ön kayıt");
      }

      for (const duplicate of duplicateStudents || []) {
        if (student.birth_date && (duplicate as any).birth_date && student.birth_date !== (duplicate as any).birth_date) continue;
        addCandidate(phoneCandidates, (duplicate as any).guardian_phone, (duplicate as any).guardian_name ? `${(duplicate as any).guardian_name} · eski/diğer kayıt` : "Veli telefonu · eski/diğer kayıt", "Diğer kursiyer kaydı");
        addCandidate(phoneCandidates, (duplicate as any).phone, "Kursiyer telefonu · eski/diğer kayıt", "Diğer kursiyer kaydı");
      }
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
            {studentId ? <Link href={`/ogrenciler/${studentId}?payment=history`} style={{padding:"11px 8px",borderRadius:11,color:"#244b6f",fontWeight:800,textAlign:"center",textDecoration:"none"}}>Ödeme Kaydı</Link> : <span style={{padding:"11px 8px",borderRadius:11,color:"#8295a7",fontWeight:800,textAlign:"center"}}>Ödeme Kaydı</span>}
            <Link href="/hazir-mesajlar" style={{padding:"11px 8px",borderRadius:11,color:"#244b6f",fontWeight:800,textAlign:"center",textDecoration:"none"}}>Hazır Mesajlar</Link>
          </nav>

          <section style={{padding:18,border:"1px solid #d9e5ef",borderRadius:16,background:"#fbfdff"}}>
            <div style={{fontSize:11,fontWeight:900,color:"#71869a"}}>SPRİNT YÜZME OKULU</div>
            <h2 style={{margin:"6px 0 14px",fontSize:22,color:"#0c3159"}}>VakıfBank</h2>
            <div style={{fontSize:12,fontWeight:900,color:"#71869a"}}>IBAN</div>
            <div style={{marginTop:6,fontSize:19,fontWeight:900,color:"#123a5d",wordBreak:"break-word"}}>TR14 0001 5001 5800 7357 4815 06</div>
            <div style={{marginTop:15,padding:14,borderRadius:12,background:"#edf5fb",color:"#315f86",fontSize:13}}>Açıklama yazmanıza gerek yok. Ödeme sonrası dekont paylaşımı isteğe bağlıdır.</div>
          </section>

          <section style={{marginTop:16,padding:18,border:"1px solid #d9e5ef",borderRadius:16,textAlign:"center",background:"#fff"}}>
            <img src="/payment/vakifbank-qr.jpg" alt="VakıfBank QR ödeme görseli" style={{display:"block",width:"min(360px,100%)",height:"auto",margin:"0 auto",borderRadius:12}} />
            <div style={{marginTop:9,fontSize:12,fontWeight:800,color:"#70859a"}}>Orijinal banka QR görseli</div>
          </section>

          <PaymentActions message={message} qrUrl="/payment/vakifbank-qr.jpg" studentId={studentId} phoneCandidates={phoneCandidates} studentName={studentName} initialLastSentAt={lastSentAt} />

          <details style={{marginTop:18,paddingTop:16,borderTop:"1px solid #e5edf4"}}>
            <summary style={{cursor:"pointer",fontSize:12,fontWeight:900,color:"#315f86"}}>Hazır ödeme mesajını görüntüle</summary>
            <pre style={{whiteSpace:"pre-wrap",font:"13px/1.55 system-ui",padding:16,borderRadius:14,background:"#f7f9fb",color:"#23384d",border:"1px solid #e1e8ef",marginTop:12}}>{message}</pre>
          </details>

          {studentId ? <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #e5edf4"}}><Link href={`/ogrenciler/${studentId}`} style={{display:"inline-flex",padding:"11px 14px",borderRadius:12,background:"#fff",color:"#0c3159",fontWeight:800,textDecoration:"none",border:"1px solid #d6e3ee",fontSize:12}}>Kursiyer Dosyasına Dön</Link></div> : null}
        </div>
      </section>
    </main>
  );
}
