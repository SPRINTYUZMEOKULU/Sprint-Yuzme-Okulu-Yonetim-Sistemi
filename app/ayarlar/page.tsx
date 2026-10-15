import Link from "next/link";
import { Fragment, cloneElement, createElement, isValidElement, type ReactNode } from "react";
import { Icons } from "@/app/components/dashboard-icons";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { readSettings, settingsAdmin } from "@/lib/settings/server";
import { isSettingSection, settingDefinitions } from "@/lib/settings/schema";
import SettingsForm from "./settings-form";
import TemplateForm from "./template-form";
import ApprovalEditor from "./approval-editor";
import FormFieldsSettings from "./on-kayit-formu/page";
import LevelsSettings from "./seviyeler/page";
import NotificationSettings from "./bildirimler/page";
import PackagesSettings from "@/app/paketler/page";
import PermissionsSettings from "@/app/kullanicilar-ve-yetkiler/settings-content";
import DocumentSettings from "@/app/veliler/icerik/settings-content";
import "./central-settings.css";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const sections = [
  { key: "kurum", title: "Kurum ve Marka", icon: "building", description: "Kurum bilgilerini burada düzenleyin; başvuru sayfası ve raporlarda aynı bilgiler kullanılsın." },
  { key: "kayit", title: "Kayıt ve Başvuru", icon: "note", description: "Başvuru kabulü, karşılama metinleri ve form alanlarını düzenleyin." },
  { key: "ders", title: "Ders ve Yoklama", icon: "calendar", description: "Yoklama denetiminin zamanlamasını ve bildirim davranışını belirleyin." },
  { key: "iptal", title: "İptal ve Telafi", icon: "clock", description: "Yürürlükteki telafi politikasını inceleyin ve yoklama işlemlerinin onay kurallarını yönetin." },
  { key: "gruplar", title: "Grup Varsayılanları", icon: "group", description: "Yeni grup kontenjanlarının varsayılan değerini düzenleyin." },
  { key: "seviyeler", title: "Yüzme Seviyeleri", icon: "levels", description: "Seviye adlarını, beceri açıklamalarını, sıralamayı ve aktifliğini yönetin." },
  { key: "paketler", title: "Paket ve Ücretler", icon: "package", description: "Ders paketlerini, ücretlerini ve yayın durumlarını düzenleyin." },
  { key: "odeme", title: "Ödeme ve Onay", icon: "wallet", description: "Ödeme, vade, kasa ve finans işlemleri için mevcut yönetici onay kurallarını düzenleyin." },
  { key: "mesajlar", title: "Mesaj Şablonları", icon: "message", description: "Kayıt, toplu iletişim ve ödeme bilgilendirmelerinde kullanılan şablonları kalıcı olarak düzenleyin." },
  { key: "bildirimler", title: "Bildirim ve Sesler", icon: "bell", description: "Bildirim alıcıları, kapsam, telefon bildirimi ve cihaz ses tercihlerini yönetin." },
  { key: "yetkiler", title: "Kullanıcı ve Yetkiler", icon: "users", description: "Kullanıcıların giriş ve modül yetkilerini düzenleyin." },
  { key: "belgeler", title: "Belge ve Onay Metinleri", icon: "shield", description: "Veli portalının belge, sağlık beyanı ve kabul metinlerini yönetin. Ön kayıt formundaki zorunlu kabul alanları Kayıt ve Başvuru bölümündedir." },
  { key: "onay-merkezi", title: "İşlem Onay Kuralları", icon: "approval", description: "Kritik işlemlerin onay ve bildirim davranışlarını belirleyin." },
  { key: "sistem", title: "Rapor ve Çıktı", icon: "chart", description: "Rapor başlığını ve A4/PDF çıktılarının alt bilgisini düzenleyin." },
  { key: "gecmis", title: "Ayar Değişiklikleri", icon: "clock", description: "Merkezi ayar ve mesaj şablonu değişikliklerinin önceki ve yeni değerlerini inceleyin." },
] as const;
// Reuse the existing editors without nesting their main landmarks inside this page.
function embeddedContent(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(embeddedContent);
  if (!isValidElement<{ children?: ReactNode; className?: string }>(node)) return node;
  if (node.type === "main") return createElement("div", { ...node.props, key: node.key, className: `${node.props.className || ""} centralEmbeddedPage` }, embeddedContent(node.props.children));
  if (typeof node.type === "string" || node.type === Fragment) return cloneElement(node, undefined, embeddedContent(node.props.children));
  return node;
}
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const profile = await requireProfile(["owner","admin"]);
  if (!profile.organization_id) throw Error("Kurum bilgisi bulunamadı.");
  const params = await searchParams;
  const requested = params.bolum === "kurallar" ? "belgeler" : params.bolum;
  const current = sections.find(s=>s.key===requested) || sections[0];
  const Icon = Icons[current.icon];
  let content: ReactNode = null;
  if (isSettingSection(current.key)) {
    const row=await readSettings(await createClient(),profile.organization_id,current.key);
    content=<><SettingsForm key={current.key} section={current.key} {...row}/>{current.key==="kayit"?<div className="centralEmbedded">{embeddedContent(await FormFieldsSettings())}</div>:null}{current.key==="ders"?<aside className="centralReadOnly">Kalan ders hesabı, kayıt başlangıcı, yoklama ve telafi kayıtlarını birlikte kullanır. Buradaki bildirim ayarı ders hakkını değiştirmez.</aside>:null}{current.key==="gruplar"?<aside className="centralReadOnly">Bu değer yeni gruplar için başlangıç önerisidir. Mevcut grupların kontenjanları değişmez; takım ve özel ders gruplarında ihtiyaca göre kontenjan belirlenir.</aside>:null}</>;
  } else if(current.key==="seviyeler") content=<div className="centralEmbedded">{embeddedContent(await LevelsSettings())}</div>;
  else if(current.key==="bildirimler") content=<div className="centralEmbedded">{embeddedContent(await NotificationSettings())}</div>;
  else if(current.key==="paketler") content=<div className="centralEmbedded">{embeddedContent(await PackagesSettings())}</div>;
  else if(current.key==="yetkiler") content=<div className="centralEmbedded">{embeddedContent(await PermissionsSettings({embedded:true}))}</div>;
  else if(current.key==="belgeler") content=<div className="centralEmbedded">{embeddedContent(await DocumentSettings({embedded:true,searchParams:Promise.resolve(params)}))}</div>;
  else if(current.key==="onay-merkezi" || current.key==="odeme" || current.key==="iptal") content=<>{current.key==="iptal"?<aside className="centralReadOnly"><strong>Yürürlükteki işletme politikası</strong><br/>Bireysel nedenlerle telafi yapılmaz. Havuz kaynaklı iptallerde telafi ayrı ders hakkı olarak izlenir. Ücret iadesi ve paket dondurma uygulanmaz. Saat ve grup değişikliği hakkı Sprint'tedir.<br/>Bu politikalar burada otomatik değiştirilmez; aşağıdaki kontroller mevcut işlem onay kurallarıdır.</aside>:null}{current.key==="odeme"?<aside className="centralReadOnly">Bu bölüm mevcut finans onaylarını yönetir. IBAN ve havale bilgilendirme metni Mesaj Şablonları bölümündedir. Fatura servisinin erişim anahtarları bu ekranda gösterilmez.</aside>:null}<ApprovalEditor organizationId={profile.organization_id} module={current.key==="odeme"?"finance":current.key==="iptal"?"attendance":undefined}/></>;
  else if(current.key==="mesajlar") {
    const {data,error}=await (await createClient()).from("message_templates").select("template_key,title,body,version").eq("organization_id",profile.organization_id).eq("is_active",true).order("title");
    if(error)throw Error("Mesaj şablonları yüklenemedi.");
    content=<><aside className="centralReadOnly">Şablonlar kaydedildiğinde yeni hazırlanacak mesajlarda kullanılır. Önceden hazırlanmış taslaklar ve gönderilmiş mesajlar korunur. Süslü parantezli değişkenlerin adlarını koruyun.</aside>{(data||[]).map(t=><TemplateForm key={t.template_key} template={t}/>)}</>;
  } else if(current.key==="gecmis") {
    const db=settingsAdmin();const{data,error}=await db.from("organization_settings_history").select("id,section,old_values,new_values,revision,changed_by,changed_at").eq("organization_id",profile.organization_id).order("changed_at",{ascending:false}).limit(100);
    if(error)throw Error("Ayar geçmişi yüklenemedi.");
    const ids=Array.from(new Set((data||[]).map(r=>r.changed_by).filter(Boolean)));
    const{data:users,error:usersError}=ids.length?await db.from("profiles").select("id,full_name").eq("organization_id",profile.organization_id).in("id",ids):{data:[],error:null};if(usersError)throw Error("İşlem sahipleri yüklenemedi.");
    const names=new Map((users||[]).map(u=>[u.id,u.full_name]));
    content=<div className="centralHistory"><p>Merkezi ayar ve şablon değişikliklerinin son 100 kaydı. Kullanıcı yetkilerinin ayrıntılı geçmişi ilgili yetki bölümündedir.</p>{!(data||[]).length?<p>Henüz bir ayar değişikliği yapılmadı.</p>:<table><thead><tr><th>Zaman</th><th>Bölüm</th><th>İşlem yapan</th><th>Sürüm</th><th>Değişiklik</th></tr></thead><tbody>{(data||[]).map(row=><tr key={row.id}><td>{new Intl.DateTimeFormat("tr-TR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Istanbul"}).format(new Date(row.changed_at))}</td><td>{sections.find(s=>s.key===row.section)?.title||row.section}</td><td>{names.get(row.changed_by)||"Yönetici"}</td><td>{row.revision}</td><td><details><summary>Önceki / yeni değerler</summary><pre>{JSON.stringify({önceki:row.old_values,yeni:row.new_values},null,2)}</pre></details></td></tr>)}</tbody></table>}</div>;
  }
  return <main className="centralSettings"><div className="centralWrap">
    <header className="centralHeader"><div><p className="centralEyebrow">SPRINTOS · YÖNETİM</p><h1>Ayarlar Merkezi</h1><p>Kurum tercihlerini düzenleyin; ilgili modüller aynı ayarlarla çalışsın.</p></div><div className="centralHeaderActions"><Link href="/"><Icons.dashboard width={18} height={18}/>Yönetim Paneli</Link><Link href="/on-kayit" target="_blank" rel="noopener noreferrer" className="centralPreview"><span className="centralPreviewIcon"><Icons.note width={19} height={19}/></span><span className="centralPreviewCopy">Ön Kayıt Önizlemesi<small>Kursiyerin göreceği form</small></span><Icons.arrow width={18} height={18}/></Link></div></header>
    <div className="centralBody"><details className="centralMobileSections" key={current.key}><summary><Icons.settings width={20} height={20}/><span><small>Ayar bölümü</small>{current.title}</span><Icons.arrow width={18} height={18}/></summary><nav aria-label="Mobil ayar bölümleri">{sections.map(section=>{const MobileIcon=Icons[section.icon];return <Link key={section.key} href={`/ayarlar?bolum=${section.key}`} aria-current={current.key===section.key?"page":undefined}><MobileIcon width={18} height={18}/>{section.title}</Link>;})}</nav></details><nav className="centralMenu" aria-label="Ayar bölümleri">{sections.map(section=>{const MenuIcon=Icons[section.icon];return <Link key={section.key} href={`/ayarlar?bolum=${section.key}`} aria-current={current.key===section.key?"page":undefined}><MenuIcon/><span>{section.title}</span></Link>;})}</nav><section className="centralContent"><div className="centralPanel"><header className="centralPanelHead"><span className="centralPanelIcon"><Icon width={24} height={24}/></span><div><h2>{current.title}</h2><p>{current.description}</p></div></header>{content}</div></section></div>
  </div></main>;
}
