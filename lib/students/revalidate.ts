import { revalidatePath } from "next/cache";
export function revalidateStudentSurfaces(studentId:string){
 for(const path of [`/ogrenciler/${studentId}`,"/ogrenciler","/ogrenciler/pasif-merkezi","/veliler","/yoklama","/raporlar","/kayit-yenilemeleri","/baslayacak-kursiyerler","/telafi-yonetimi","/ders-operasyonlari","/hazir-mesajlar","/ders-operasyonlari/gecmis","/veli-paneli","/veli-devam","/veli-odemeler","/veli-mesajlar","/veli-gelisim","/"])revalidatePath(path);
}
