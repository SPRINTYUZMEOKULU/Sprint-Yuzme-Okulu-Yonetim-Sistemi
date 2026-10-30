"use client";
import Link from "next/link";
export default function StudentFileError({reset}:{reset:()=>void}){
 return <main style={{maxWidth:600,margin:"64px auto",padding:24,fontFamily:"system-ui",color:"#17345c"}} role="alert"><h1>Kursiyer dosyası açılamadı</h1><p>Sayfa yüklenirken bir hata oluştu. İşlem yaptıysanız yeniden kaydetmeden önce dosyayı kontrol edin.</p><button type="button" onClick={reset}>Yeniden Dene</button><p><Link href="/ogrenciler">Öğrenci Merkezine Dön</Link></p></main>;
}
