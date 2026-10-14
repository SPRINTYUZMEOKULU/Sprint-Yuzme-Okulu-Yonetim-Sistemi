import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;format:string}>}) {
  const profile=await requireProfile(["owner","admin","accounting"]);
  const {id,format}=await params;
  if(!profile.organization_id||!["pdf","xml"].includes(format))return new NextResponse("Belge bulunamadı.",{status:404});
  const {data,error}=await documentAdmin().from("payment_document_requests").select("document_pdf_url,document_xml_url").eq("organization_id",profile.organization_id).eq("id",id).maybeSingle();
  const target=format==="pdf"?data?.document_pdf_url:data?.document_xml_url;
  if(error||!target)return new NextResponse("Belge henüz hazır değil.",{status:404});
  try { const url=new URL(target);if(url.protocol!=="https:"||url.username||url.password||!["isnet.net.tr","nettefatura.com.tr"].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw Error();return NextResponse.redirect(url, {status:303,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}}); }catch{return new NextResponse("Belge bağlantısının sağlayıcı adresi doğrulanmalı.",{status:409});}
}
