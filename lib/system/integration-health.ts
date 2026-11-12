type HealthRow={key:string;title:string;count:number|null;state:"ok"|"warning"|"pending";description:string;href:string;action?:string};
export function integrationHealthRows(checks:Record<string,number>):HealthRow[]{
 const configs=[
  ["missing_plan","Kayıt ve Ders Planı","Aktif kayıt dönemi için ders planı eksikliği.","/ogrenciler"],
  ["missing_membership","Grup Bağlantıları","Aktif dönemiyle eşleşmeyen grup üyelikleri.","/ogrenciler"],
  ["plan_mismatch","Program ve Dönem Uyumu","Başlangıç, bitiş, paket veya gün bilgisi uyuşmazlıkları.","/ogrenciler"],
  ["period_link_mismatch","Öğrenci ve Dönem İlişkileri","Yoklama, ödeme, borç, plan ve telafide yanlış öğrenci/dönem bağlantıları.","/ogrenciler"],
  ["counter_mismatch","Ders Sayaçları","Planlı ders hesabıyla henüz eşitlenmemiş sayaçlar. Zamanlı kontrol ve ilgili işlem ekranları mevcut hesaplama motorunu kullanır.","/yoklama"],
  ["overdue_renewal","Yeni Dönem Başlangıçları","Başlangıç tarihi gelmiş ancak açılmamış kayıt dönemleri.","/baslayacak-kursiyerler"],
  ["duplicate_makeups","Telafi Tekrarları","Aynı öğrenci, tarih ve seanstaki tekrar eden telafi kayıtları.","/telafi-yonetimi"],
  ["legacy_unplanned_makeups","Eski Telafi Onayları","Onay kaydı olan fakat talebe bağlı tarihli planı bulunmayan eski işlemler. Geçmiş bakiyeyi değiştirmeden yönetici kontrolü gerekir.","/onay-merkezi?status=approved"],
  ["pending_lesson_approvals","Bekleyen Ders ve Telafi Talepleri","Bu talepler henüz onaylanmadı. Bekleyen talep tek başına sistem hatası değildir.","/onay-merkezi"],
  ["sent_without_timestamp","Mesaj Geçmişi","Gönderildi işaretli fakat gönderim zamanı bulunmayan kayıtlar.","/hazir-mesajlar"],
  ["invalid_guardian_links","Veli ve Öğrenci Bağlantıları","Kurumuyla uyuşmayan veli–öğrenci bağlantıları.","/veliler"],
 ];
 return configs.map(([key,title,description,href])=>{const count=Number(checks?.[key]);const known=Number.isFinite(count)&&count>=0;return {key,title,description:known?description:"Kontrol sonucu alınamadı. Sağlıklı olarak işaretlenmedi.",href,count:known?count:null,state:!known?"warning":count===0?"ok":key==="pending_lesson_approvals"?"pending":"warning"};});
}
export function schedulerHealth(scheduler:any,now=Date.now()){
 const time=Date.parse(scheduler?.last_success_at||"");
 const recent=Number.isFinite(time)&&time<=now&&now-time<15*60*1000;
 if(recent&&scheduler?.http_status===200&&!scheduler?.timed_out)return {state:"ok",title:"Zamanlı kontrol çalışıyor",description:"Uygulama kapalıyken ders sayaçları, eksik yoklama ve tamamlanmamış kayıt bildirimleri sunucuda kontrol ediliyor."};
 if(scheduler?.http_status && scheduler.http_status!==200 || scheduler?.timed_out)return {state:"warning",title:"Son kontrol tamamlanamadı",description:"Zamanlı çağrı başarısız. Cihaz bildirimi testi bu bağlantının yerine geçmez; sunucu kontrolü incelenmeli."};
 return {state:"warning",title:"Güncel çalışma doğrulanamadı",description:"Son 15 dakikada başarılı zamanlı kontrol bulunmuyor. Zamanlayıcı bağlantısı kontrol edilmeli."};
}
