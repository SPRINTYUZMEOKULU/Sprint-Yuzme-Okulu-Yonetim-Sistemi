import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
export default async function Page(){await requireProfile(["owner","admin"]);redirect("/ayarlar?bolum=mesajlar");}
