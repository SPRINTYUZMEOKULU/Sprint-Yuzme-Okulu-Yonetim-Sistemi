export type PortalCredential = {
    accountId: string;
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    revision: string;
};
export function portalMessage(input: Pick<PortalCredential, 'fullName' | 'phone' | 'email' | 'password'>, origin: string) {
    const base=origin.replace(/\/$/,'');
    return [
        '*SPRİNT YÜZME OKULU*\n*Veli / Kursiyer Portalına Hoş Geldiniz*',
        `Merhaba ${input.fullName || 'Değerli Velimiz / Kursiyerimiz'},`,
        'Ders programınızı, kalan derslerinizi, telafilerinizi, yoklama ve ödeme bilgilerinizi SPRİNTos üzerinden takip edebilirsiniz. Duyuruları okuyabilir, yönetime talep iletebilirsiniz.',
        `*Giriş bağlantınız*\n${base}/login`,
        `*Giriş telefonu*\n${input.phone}`,
        '*Size özel giriş şifreniz*\n(Yalnızca aşağıdaki şifreyi kopyalayın.)\n```' + input.password + '```',
        '*İlk giriş · 3 adım*\n1. Bağlantıyı açıp *Veli Girişi* bölümünü seçin. Yetişkin kursiyerlerimiz de bu bölümü kullanır.\n2. *Telefon ile giriş* seçeneğinde yukarıdaki telefon numarasını ve şifreyi yazın.\n3. *Veli Girişi* düğmesine dokunun. Birden fazla kursiyer bağlıysa üst bölümden ilgili ismi seçin.',
        '*Şifrenizi kendiniz belirleyin*\nGiriş yaptıktan sonra *Tüm Menü → Hesabım ve Şifrem* bölümünden mevcut şifrenizi ve yeni şifrenizi girerek değiştirebilirsiniz. Aynı hesaba bağlı kursiyerler için tek şifre kullanılır.',
        `*Görsel kullanım rehberi*\n${base}/portal-rehberi`,
        'Girişte sorun yaşarsanız *Şifremi unuttum* üzerinden talep bırakabilir veya bize yazabilirsiniz. Giriş bilgilerinizi yalnızca hesabınızı kullanacak kişiyle paylaşın.',
        '*Bilgi ve destek:* 0551 896 83 19\nSprint Yüzme Okulu Yönetimi',
    ].join('\n\n');
}
export function portalGuideMessage(origin:string){
    return `*SPRİNT YÜZME OKULU | PORTAL KULLANIM REHBERİ*\n\nDers, telafi, yoklama ve ödeme bilgilerinize nasıl ulaşacağınızı; giriş ve şifre değiştirme adımlarını görsel rehberimizden inceleyebilirsiniz.\n\n${origin.replace(/\/$/,'')}/portal-rehberi\n\nGirişte size özel iletilen telefon numarası ve şifreyi kullanın. Yetişkin kursiyerlerimiz de *Veli Girişi* bölümünden giriş yapar.\n\n*Destek:* 0551 896 83 19`;
}
