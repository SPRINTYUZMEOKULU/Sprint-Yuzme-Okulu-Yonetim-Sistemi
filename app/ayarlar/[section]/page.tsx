import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
export const dynamic = "force-dynamic";
const sections = ["kurum","yetkiler","kurallar","belgeler","sistem","kayit","ders","gruplar","paketler","iptal","odeme","gecmis"];
export default async function Page({params}:{params:Promise<{section:string}>}) {
 await requireProfile(["owner","admin"]);const{section}=await params;
 if(!sections.includes(section))notFound();
 redirect(`/ayarlar?bolum=${section==="kurallar"?"belgeler":section}`);
}
