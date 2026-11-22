import Link from "next/link";
export default function PortalDataMap(){
 const rows=[['Kursiyer dosyası · Kayıt, grup, paket ve eğitmen','Genel Bakış · Kurs Bilgileri'],['Ders programı ve kursiyerin katılım günleri','Dersler & Yoklama · Haftalık Program'],['Yoklama kaydet / güncelle','Dersler & Yoklama · Yoklama Geçmişi'],['Kursiyer dosyası · Ödeme Al / ödeme planı','Ödemeler · Paket bakiyesi, taksitler ve tahsilatlar'],['Veli dosyası · Gelişim notu · Veliye görünür','Gelişim · Paylaşılan notlar'],['Veli dosyası · Portal mesajı gönder','Mesajlar · Okundu durumu veli dosyasına yansır'],['Portal İçerikleri · Genel, şube veya grup duyurusu','Duyurular · Yalnız ilgili kursiyerin duyuruları'],['Portal İçerikleri · Belge yayınla','Belgeler · Metin ve istenmişse sürüm bazında onay'],['Veli Talep Merkezi · Yanıt / durum güncelle','Talep ve Görüşlerim · Yönetimin cevabı']];
 return (
   <section className="guardianPanel portalDataHelp">
     <div className="guardianHeroActions"><Link className="primary" href="/veliler/icerik#duyurular">Duyuruları Yönet</Link><Link className="primary" href="/veliler/icerik#kurallar">Kuralları ve Belgeleri Yönet</Link></div>
     <details>
       <summary>Portal Bilgi Rehberi</summary>
       <div className="portalDataHelpContent">
         <p>Her veli yalnızca portal erişimi verilmiş aktif kursiyerlerini görür. Birden fazla kursiyerde seçim açık sekme boyunca korunur.</p>
         <div className="portalDataHelpTable">
           <table>
             <thead>
               <tr><th scope="col">Yönetimde girilen bilgi</th><th scope="col">Veli portalında göründüğü yer</th></tr>
             </thead>
             <tbody>
               {rows.map(([source, destination]) => <tr key={source}><td>{source}</td><td>{destination}</td></tr>)}
             </tbody>
           </table>
         </div>
         <p>WhatsApp’ta gönderim ve okunma durumunu sohbetten kontrol edebilirsiniz. Portal mesajlarının okunma durumu Veli Merkezi’nde görünür.</p>
       </div>
     </details>
   </section>
 );
}
