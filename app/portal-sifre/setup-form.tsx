"use client";

import { useEffect, useState, type FormEvent } from "react";
import { setPortalPassword } from "./actions";
import "./setup.css";

type SupportKind = "password" | "password_reset_error";

export default function SetupForm() {
    const [token, setToken] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [pending, setPending] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const [supportKind, setSupportKind] = useState<SupportKind | null>(null);
    const [phone, setPhone] = useState("");
    const [supportPending, setSupportPending] = useState(false);
    const [supportResult, setSupportResult] = useState<{ ok: boolean; message: string } | null>(null);

    function openSupport(kind: SupportKind) {
        setSupportKind(kind);
        setSupportResult(null);
    }

    async function submitSupport(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!supportKind || supportPending || supportResult?.ok) return;
        const identifier = phone.replace(/[^0-9]/g, "").replace(/^(?:0090|90|0)(?=[0-9]{10}$)/, "");
        if (!/^[0-9]{10}$/.test(identifier)) {
            setSupportResult({ ok: false, message: "Lütfen geçerli bir telefon numarası girin." });
            return;
        }

        setSupportPending(true);
        setSupportResult(null);
        try {
            const response = await fetch("/api/auth/support-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind: supportKind,
                    role: "guardian",
                    method: "phone",
                    identifier,
                    message: supportKind === "password"
                        ? "Şifremi unuttum. Telefonuma yeni bir şifre oluşturma bağlantısı istiyorum."
                        : `Veli paneli şifremi yenileyemiyorum. Ekrandaki durum: ${error || (token ? "Şifre oluşturma işlemi tamamlanmadı." : "Şifre oluşturma bağlantısı eksik.")}`,
                }),
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error("Talep gönderilemedi.");
            setSupportResult({ ok: true, message: result.message });
        } catch {
            setSupportResult({ ok: false, message: "Talep gönderilemedi. Lütfen tekrar deneyin." });
        } finally {
            setSupportPending(false);
        }
    }

    useEffect(() => {
        const value = window.location.hash.slice(1);
        setToken(value);
        if (value) window.history.replaceState(window.history.state, "", window.location.pathname);
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!token || pending) return;
        if (password !== confirmation) {
            setError("Girdiğiniz iki şifre aynı olmalıdır.");
            return;
        }
        setPending(true);
        setError("");
        try {
            const message = await setPortalPassword(token, password);
            if (message) setError(message);
            else {
                setPassword("");
                setConfirmation("");
                setDone(true);
            }
        } catch {
            setError("Şifre işlemi sırasında bağlantı kesildi veya sunucu yanıt vermedi. Tekrar deneyin.");
        } finally {
            setPending(false);
        }
    }

    return <main className="portalSetup">
        <section>
            <strong>SPRINT YÜZME OKULU</strong>
            <h1>{done ? "Şifreniz hazır" : "Portal şifrenizi oluşturun"}</h1>
            {done ? <>
                <p>Veli Girişi ekranında kayıtlı telefon numaranızı ve yeni şifrenizi kullanabilirsiniz.</p>
                <a href="/login">Giriş ekranını aç</a>
            </> : token ? <form onSubmit={submit} noValidate>
                <label>Yeni şifre<input type="password" autoComplete="new-password" minLength={8} maxLength={100}
                    value={password} onChange={event => setPassword(event.target.value)} required /></label>
                <label>Yeni şifre (tekrar)<input type="password" autoComplete="new-password" minLength={8} maxLength={100}
                    value={confirmation} onChange={event => setConfirmation(event.target.value)} required /></label>
                <button disabled={pending}>{pending ? "Kaydediliyor…" : "Şifremi kaydet"}</button>
                {error && <p role="alert">{error}</p>}
            </form> : token === "" ? <>
                <p>Şifre oluşturma bağlantısı eksik. WhatsApp’tan aldığınız bağlantıyı açın veya aşağıdan yeni bağlantı isteyin.</p>
            </> : null}
            {!done && token !== null && <div className="portalSetupSupport">
                <button type="button" disabled={supportPending} onClick={() => openSupport("password")}>Şifremi unuttum · Yeni bağlantı iste</button>
                <button type="button" disabled={supportPending} onClick={() => openSupport("password_reset_error")}>Şifremi yenileyemiyorum</button>
                {supportKind && !supportResult?.ok && <form onSubmit={submitSupport}>
                    <label>Hesabınızda kayıtlı telefon numarası
                        <input type="tel" autoComplete="tel" maxLength={30} value={phone}
                            onChange={event => setPhone(event.target.value)} required disabled={supportPending} />
                    </label>
                    <button disabled={supportPending}>
                        {supportPending ? "Gönderiliyor…" : supportKind === "password" ? "Yeni bağlantı talebi gönder" : "Sorunu yönetime bildir"}
                    </button>
                </form>}
                {supportResult && <p role={supportResult.ok ? "status" : "alert"}>{supportResult.message}</p>}
                <a href="/login">Veli girişine dön</a>
            </div>}
        </section>
    </main>;
}
