"use client";
import { generatePortalPassword } from "@/lib/guardian/password";
import { useEffect, useRef, useState } from 'react';
import { confirmPortalSetupSent, createPortalSetupLink, portalCredentialContact, savePortalCredential } from './portal-credential-actions';
import { portalCredentialDraft, rememberPortalCredential } from '@/lib/guardian/credential-draft';
import { portalGuideMessage, portalSetupWhatsAppUrl, type PortalCredential } from '@/lib/guardian/portal-message';
import './portal-credential-manager.css';
export default function PortalCredentialManager({ accountId, studentId, initialCredential }: {
    accountId?: string;
    studentId?: string;
    initialCredential?: PortalCredential;
}) {
    const [credential, setCredential] = useState<PortalCredential | null>(null);
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [fallbackText, setFallbackText] = useState('');
    const [pendingDispatch, setPendingDispatch] = useState('');
    const lock = useRef(false);
    useEffect(() => {
        let live = true;
        if (initialCredential)
            rememberPortalCredential(initialCredential);
        const refresh = async () => { const contact = await portalCredentialContact({ accountId, studentId }); if (!live)
            return; if (contact.ok) {
            setCredential(portalCredentialDraft(contact.accountId, contact.revision));
        }
        else {
            setCredential(null);
            setStatus(contact.message);
        } };
        const changed = () => { void refresh().catch(() => { if (live)
            setStatus('Giriş bilgileri kontrol edilemedi.'); }); };
        changed();
        window.addEventListener('portal-credential-changed', changed);
        return () => { live = false; window.removeEventListener('portal-credential-changed', changed); };
    }, [accountId, studentId, initialCredential]);
    function generatePassword() {
        const generated = generatePortalPassword();
        setPassword(generated);
        setShow(true);
        setStatus('Güçlü şifre oluşturuldu. Hesaba uygulamak için Yeni Şifreyi Kaydet seçeneğini kullanın.');
    }
    async function save() {
        if (lock.current) return;
        if (password.length < 8) {
            setStatus('Şifre en az 8 karakter olmalıdır. Daha uzun bir şifre girin.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setStatus('Şifre kaydediliyor…');
        setFallbackText('');
        try {
            const result = await savePortalCredential({ accountId, studentId }, password);
            if (!result.ok) {
                setStatus(result.message);
                return;
            }
            rememberPortalCredential(result);
            setCredential(result);
            setPassword('');
            setStatus(result.message);
        }
        catch {
            setStatus('İşlem sonucu doğrulanamadı. Mesaj göndermeden önce şifreyi yeniden kaydedin.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function current() { if (!credential)
        return null; const contact = await portalCredentialContact({ accountId: credential.accountId }); if (!contact.ok || contact.revision !== credential.revision || !portalCredentialDraft(credential.accountId, credential.revision)) {
        setCredential(null);
        setStatus('Giriş bilgileri değişmiş veya paylaşım süresi dolmuş. Yeni şifre belirleyip kaydedin.');
        return null;
    } return { ...credential, fullName: contact.fullName, phone: contact.phone, email: contact.email }; }
    async function copy(kind: 'password' | 'phone') {
        let verifiedText: string | undefined;
        setFallbackText('');
        try {
            // Safari requires the clipboard request to start inside the tap gesture.
            const verified = current().then(value => {
                if (!value) throw new Error('Giriş bilgileri geçerli değil.');
                const text = kind === 'password' ? value.password : value.phone;
                verifiedText = text;
                return new Blob([text], {type: 'text/plain'});
            });
            if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
                await navigator.clipboard.write([new ClipboardItem({'text/plain': verified})]);
            } else {
                await verified;
                await navigator.clipboard.writeText(verifiedText!);
            }
            setStatus(kind === 'password' ? 'Şifre kopyalandı.' : 'Telefon kopyalandı.');
        } catch {
            if (verifiedText !== undefined) {
                setFallbackText(verifiedText);
                setStatus('Metni aşağıdaki alandan seçip kopyalayabilirsiniz.');
            } else {
                setStatus('Giriş bilgileri doğrulanamadı veya değişmiş. Paylaşmadan önce tekrar kontrol edin.');
            }
        }
    }
    async function share() {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        // Open a tab synchronously on the tap: iOS Safari blocks popups opened after awaits.
        const target = window.open('about:blank', '_blank');
        if (target) target.opener = null;
        try {
            const value = await createPortalSetupLink({ accountId, studentId });
            if (!value.ok) {
                target?.close();
                setStatus(value.message);
                return;
            }
            const href = portalSetupWhatsAppUrl(value, window.location.origin);
            if (target) target.location.replace(href);
            else window.location.assign(href);
            setPendingDispatch(value.dispatchId);
            setStatus('WhatsApp mesajı açıldı. Gönderimi WhatsApp üzerinden onaylayın.');
        } catch {
            target?.close();
            setStatus('Giriş bilgileri doğrulanamadı. Tekrar deneyin.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function confirmSent() {
        if (!pendingDispatch || lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
            const result = await confirmPortalSetupSent(pendingDispatch);
            setStatus(result.message);
            if (result.ok) setPendingDispatch('');
        } catch {
            setStatus('Gönderim kaydedilemedi. Tekrar deneyin.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function shareGuide() {
        const target=window.open('about:blank','_blank');
        if(target)target.opener=null;
        try {
            const contact=await portalCredentialContact({accountId,studentId});
            if(!contact.ok||!contact.phone){target?.close();setStatus(contact.ok?'Rehber paylaşımı için kayıtlı telefon bulunamadı.':contact.message);return;}
            const href=`https://wa.me/${contact.phone.replace(/\D/g,'')}?text=${encodeURIComponent(portalGuideMessage(window.location.origin))}`;
            if(target)target.location.replace(href);else window.location.assign(href);
            setStatus('Kullanım rehberi mesajı WhatsApp’ta açıldı. Gönderimi WhatsApp üzerinden onaylayın.');
        }catch{target?.close();setStatus('Rehber paylaşımı için alıcı doğrulanamadı.');}
    }
    return <section className="portalCredentialManager" aria-label="Portal giriş bilgileri">
    <h3>Portal şifresi ve giriş bilgileri</h3>
    <p>WhatsApp bağlantısıyla veli kendi şifresini oluşturur. Aynı hesaba bağlı tüm kursiyerler bu şifreyi kullanır.</p>
    <div className="credentialButtons"><button type="button" className="credentialWhatsapp" onClick={share} disabled={busy || !!pendingDispatch}>Şifre Oluşturma Mesajını WhatsApp’ta Aç</button><a href="/portal-rehberi" target="_blank" rel="noreferrer">Görsel Rehberi Aç</a><button type="button" onClick={()=>void shareGuide()} disabled={busy}>Rehberi WhatsApp’ta Aç</button></div>
    {pendingDispatch && <div className="credentialButtons">
      <button type="button" onClick={confirmSent} disabled={busy}>Gönderildi Olarak Kaydet</button>
      <button type="button" disabled={busy} onClick={() => { setPendingDispatch(''); setStatus('Mesaj taslak olarak kaldı.'); }}>Göndermedim</button>
    </div>}
    {!credential ? <p className="credentialHint">Mevcut şifre güvenlik nedeniyle okunamaz. Bu oturumda hazırlanan şifre varsa burada kullanılır; yoksa yeni şifre belirleyip kaydedin.</p> : null}
    <label>Yeni şifre<input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); if (status.startsWith('Şifre en az')) setStatus(''); }} minLength={8} maxLength={100} disabled={busy} aria-describedby="portalPasswordRules"/></label>
    <p id="portalPasswordRules" className="credentialHint">En az 8 karakter kullanın. Mevcut veli şifresini değiştirmek istemiyorsanız yeniden kaydetmeyin.</p>
    <div className="credentialButtons"><button type="button" onClick={generatePassword} disabled={busy}>Güçlü Şifre Oluştur</button><button type="button" onClick={() => setShow(v => !v)} aria-pressed={show}>{show ? 'Şifreyi gizle' : 'Şifreyi göster'}</button><button type="button" className="credentialPrimary" disabled={busy || password.length < 8} onClick={save}>{busy ? 'Kaydediliyor…' : 'Yeni Şifreyi Kaydet'}</button></div>
    {credential ? <div className="credentialReady"><strong>{credential.fullName} · Giriş bilgileri hazır</strong><label>Giriş telefonu<input readOnly value={credential.phone} onFocus={e => e.target.select()}/></label><label>Kaydedilen şifre<input type={show ? 'text' : 'password'} readOnly value={credential.password} onFocus={e => e.target.select()}/></label><div className="credentialButtons"><button type="button" onClick={() => copy('phone')}>Telefonu Kopyala</button><button type="button" onClick={() => copy('password')}>Şifreyi Kopyala</button></div></div> : null}
    {fallbackText ? <label>Kopyalanacak metin<textarea readOnly rows={4} value={fallbackText} onFocus={event => event.target.select()}/></label> : null}
    {status ? <p role="status" aria-live="polite">{status}</p> : null}
  </section>;
}
