export type PortalCredential = {
    accountId: string;
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    revision: string;
};
export function portalMessage(input: Pick<PortalCredential, 'fullName' | 'phone' | 'email' | 'password'>, origin: string) {
    return ['*SPRİNT YÜZME OKULU*', `Merhaba ${input.fullName || 'Değerli Velimiz'},`, 'Veli / Kursiyer Portalı giriş bilgileriniz:', `Giriş adresi: ${origin}/login`, `Kullanıcı adı (telefon): ${input.phone}`, input.email ? `E-posta: ${input.email}` : '', 'Geçici şifre (yalnızca aşağıdaki satırı kopyalayın):', '```' + input.password + '```', 'Giriş ekranında Veli Girişi bölümünü seçin. İlk girişten sonra şifrenizi değiştirmenizi öneririz.', 'Bilgilendirme Hattı: 0551 896 83 19'].filter(Boolean).join('\n\n');
}
