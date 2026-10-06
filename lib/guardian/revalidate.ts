import { revalidatePath } from "next/cache";

export function revalidateGuardianConnection(profileId: string, studentId: string) {
  for (const path of ["/veliler", `/veliler/${profileId}`, "/ogrenciler",
    `/ogrenciler/${studentId}`, "/veliler/ogrenciden-olustur",
    "/ogrenciler/pasif-merkezi", "/veli-paneli", "/veli-talepleri",
    "/devam", "/veli-gelisim", "/veli-mesajlar"]) revalidatePath(path);
}
