import UiIcon from "@/app/components/ui-icon";
import Link from 'next/link';
import {loadGuardianPage} from '@/lib/guardian/page-context';
import {GuardianHeader} from '../veli-paneli/guardian-ui';
import PasswordForm from './password-form';
import '../veli-paneli/veli.css';
import './account.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{child?:string;previewGuardian?:string}>}){
 const {profile,data,previewGuardian}=await loadGuardianPage(await searchParams,'access');
 return <main className="guardianShell"><GuardianHeader name={profile.full_name||'Değerli Velimiz / Kursiyerimiz'} students={data.students} selectedId={data.selected?.id} issues={data.issues} previewGuardian={previewGuardian}/><div className="guardianContent guardianAccount"><div className="guardianAccountHeading"><div><h1 className="guardianSectionTitle">Hesabım ve Şifrem</h1><p className="guardianSectionLead">Giriş güvenliğinizi yönetin, portalı kolayca kullanın.</p></div><Link href="/portal-rehberi">Görsel Kullanım Rehberi <UiIcon name="arrowRight" size={16}/></Link></div><div className="guardianAccountLayout"><section className="guardianCard">{previewGuardian?<div className="guardianPasswordIntro"><h2>Şifre değiştirme alanı</h2><p>Veli / kursiyer kendi hesabıyla giriş yaptığında mevcut şifresini doğrulayarak yeni şifre belirleyebilir. Yönetici önizlemesinde şifre değiştirme işlemi yapılamaz.</p></div>:<PasswordForm/>}</section><aside className="guardianAccountAside"><section className="guardianCard"><span className="guardianAccountTag">ORTAK HESAP</span><h2>Bir hesap, bağlı kursiyerleriniz</h2><p>Şifreniz bu hesaba bağlı tüm kursiyerler için geçerlidir. Şifre değişikliği ders, telafi, ödeme veya kursiyer bağlantılarını değiştirmez.</p></section><section className="guardianCard"><h2>Yardıma mı ihtiyacınız var?</h2><p>Mevcut şifrenizi hatırlamıyorsanız giriş ekranındaki “Şifremi unuttum” seçeneğiyle yönetime talep bırakabilirsiniz.</p><Link href="/portal-rehberi#destek">Giriş ve destek adımları <UiIcon name="arrowRight" size={16}/></Link><a href="https://wa.me/905518968319" target="_blank" rel="noreferrer">WhatsApp · 0551 896 83 19</a></section></aside></div></div></main>;
}
