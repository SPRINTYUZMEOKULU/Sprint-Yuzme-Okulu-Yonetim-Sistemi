"use client";
import {useRef,useState,type FormEvent} from 'react';
export default function PasswordForm(){
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState<{ok:boolean;message:string}|null>(null);
 const lock=useRef(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;
  const form=event.currentTarget,data=new FormData(form);
  const currentPassword=String(data.get('currentPassword')||''),newPassword=String(data.get('newPassword')||''),confirmPassword=String(data.get('confirmPassword')||'');
  if(newPassword!==confirmPassword){setResult({ok:false,message:'Yeni şifreler eşleşmiyor.'});return;}
  if(newPassword===currentPassword){setResult({ok:false,message:'Yeni şifreniz mevcut şifrenizden farklı olmalıdır.'});return;}
  lock.current=true;setBusy(true);setResult(null);
  try{
   const response=await fetch('/api/guardian-account/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword,confirmPassword})});
   if(response.redirected)throw Error('Oturumunuz sona ermiş olabilir. Yeniden giriş yapın.');
   const answer=await response.json();setResult({ok:response.ok&&answer.ok,message:answer.message||'İşlem tamamlanamadı.'});
   if(response.ok&&answer.ok){form.reset();setShow(false);}
  }catch(error){setResult({ok:false,message:error instanceof Error?error.message:'İşlem doğrulanamadı. Girişinizi kontrol edip yeniden deneyin.'});}
  finally{lock.current=false;setBusy(false);}
 }
 return <form className="guardianPasswordForm" onSubmit={submit}>
  <div className="guardianPasswordIntro"><span className="guardianAccountTag">HESAP GÜVENLİĞİ</span><h2>Şifrenizi değiştirin</h2><p>Size iletilen giriş şifresi yerine yalnızca sizin bildiğiniz bir şifre belirleyin.</p></div>
  <label>Mevcut şifreniz<input name="currentPassword" type={show?'text':'password'} autoComplete="current-password" required maxLength={100} disabled={busy}/></label>
  <div className="guardianPasswordGrid"><label>Yeni şifreniz<input name="newPassword" type={show?'text':'password'} autoComplete="new-password" minLength={8} maxLength={100} required disabled={busy} aria-describedby="guardian-password-help"/></label><label>Yeni şifreniz (tekrar)<input name="confirmPassword" type={show?'text':'password'} autoComplete="new-password" minLength={8} maxLength={100} required disabled={busy}/></label></div>
  <p id="guardian-password-help" className="guardianAccountMuted">En az 8 karakter kullanın. Harf, rakam ve sembol içeren, başka bir hesabınızda kullanmadığınız bir şifre tercih edin.</p>
  <label className="guardianPasswordShow"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} disabled={busy}/>Şifreleri göster</label>
  <button className="guardianAccountButton" type="submit" disabled={busy}>{busy?'Güncelleniyor…':'Yeni Şifremi Kaydet'}</button>
  {result&&<p className={'guardianPasswordResult '+(result.ok?'success':'error')} role={result.ok?'status':'alert'}>{result.message}</p>}
 </form>;
}
