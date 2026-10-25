"use client";
import { useEffect, useRef, useState } from 'react';
import { portalCredentialContact, savePortalCredential } from './portal-credential-actions';
import { portalCredentialDraft, rememberPortalCredential } from '@/lib/guardian/credential-draft';
import { portalMessage, type PortalCredential } from '@/lib/guardian/portal-message';
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
    async function copy(kind: 'password' | 'phone' | 'message') {
        let verifiedText: string | undefined;
        setFallbackText('');
        try {
            // Safari requires the clipboard request to start inside the tap gesture.
            const verified = current().then(value => {
                if (!value) throw new Error('Giriş bilgileri geçerli değil.');
                const text = kind === 'password' ? value.password : kind === 'phone' ? value.phone : portalMessage(value, window.location.origin);
                verifiedText = text;
                return new Blob([text], {type: 'text/plain'});
            });
            if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
                await navigator.clipboard.write([new ClipboardItem({'text/plain': verified})]);
            } else {
                await verified;
                await navigator.clipboard.writeText(verifiedText!);
            }
            setStatus(kind === 'password' ? 'Şifre kopyalandı.' : kind === 'phone' ? 'Telefon kopyalandı.' : 'Giriş bilgileri kopyalandı.');
        } catch {
            if (verifiedText !== undefined) {
                setFallbackText(verifiedText);
                setStatus('Metni aşağıdaki alandan seçip kopyalayabilirsiniz.');
            } else {
                setStatus('Giriş bilgileri doğrulanamadı veya değişmiş. Paylaşmadan önce tekrar kontrol edin.');
            }
        }
    }
    async function share() { try {
        const value = await current();
        if (!value)
            return;
        if (!value.phone) {
            setStatus('WhatsApp için kayıtlı telefon ekleyin. Giriş bilgilerini kopyalayabilirsiniz.');
            return;
        }
        const href = `https://wa.me/${value.phone.replace(/\D/g, '')}?text=${encodeURIComponent(portalMessage(value, window.location.origin))}`;
        window.location.assign(href);
    }
    catch {
        setStatus('Giriş bilgileri doğrulanamadı. Tekrar deneyin.');
    } }
    return <section className="portalCredentialManager" aria-label="Portal giriş bilgileri">
    <h3>Portal şifresi ve giriş bilgileri</h3>
    <p>Mesajı açmak şifreyi değiştirmez. Aynı veli hesabına bağlı tüm kursiyerler aynı şifreyi kullanır.</p>
    {!credential ? <p className="credentialHint">Mevcut şifre güvenlik nedeniyle okunamaz. Bu oturumda hazırlanan şifre varsa burada kullanılır; yoksa yeni şifre belirleyip kaydedin.</p> : null}
    <label>Yeni şifre<input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); if (status.startsWith('Şifre en az')) setStatus(''); }} minLength={8} maxLength={100} disabled={busy} aria-describedby="portalPasswordRules"/></label>
    <p id="portalPasswordRules" className="credentialHint">En az 8 karakter kullanın. Şifreyi kaydetmeden WhatsApp paylaşımı açılamaz. Mevcut veli şifresini değiştirmek istemiyorsanız yeniden kaydetmeyin.</p>
    <div className="credentialButtons"><button type="button" onClick={() => setShow(v => !v)} aria-pressed={show}>{show ? 'Şifreyi gizle' : 'Şifreyi göster'}</button><button type="button" className="credentialPrimary" disabled={busy || password.length < 8} onClick={save}>{busy ? 'Kaydediliyor…' : 'Yeni Şifreyi Kaydet'}</button></div>
    {!credential ? <p className="credentialHint" role="status">WhatsApp paylaşımı için önce en az 8 karakterlik yeni şifreyi kaydedin.</p> : null}
    {credential ? <div className="credentialReady"><strong>{credential.fullName} · Giriş bilgileri hazır</strong><label>Giriş telefonu<input readOnly value={credential.phone} onFocus={e => e.target.select()}/></label><label>Kaydedilen şifre<input type={show ? 'text' : 'password'} readOnly value={credential.password} onFocus={e => e.target.select()}/></label><div className="credentialButtons"><button type="button" onClick={() => copy('phone')}>Telefonu Kopyala</button><button type="button" onClick={() => copy('password')}>Şifreyi Kopyala</button><button type="button" onClick={() => copy('message')}>Giriş Bilgilerini Kopyala</button><button type="button" className="credentialWhatsapp" onClick={share}>WhatsApp Mesajını Aç</button></div></div> : null}
    {fallbackText ? <label>Kopyalanacak metin<textarea readOnly rows={4} value={fallbackText} onFocus={event => event.target.select()}/></label> : null}
    {status ? <p role="status" aria-live="polite">{status}</p> : null}
  </section>;
}
