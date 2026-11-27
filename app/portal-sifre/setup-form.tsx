"use client";

import { useEffect, useState, type FormEvent } from "react";
import { setPortalPassword } from "./actions";
import "./setup.css";

export default function SetupForm() {
    const [token, setToken] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [pending, setPending] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

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
            setError("İşlem tamamlanamadı. Tekrar deneyin.");
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
            </> : token ? <form onSubmit={submit}>
                <label>Yeni şifre<input type="password" autoComplete="new-password" minLength={8} maxLength={100}
                    value={password} onChange={event => setPassword(event.target.value)} required /></label>
                <label>Yeni şifre (tekrar)<input type="password" autoComplete="new-password" minLength={8} maxLength={100}
                    value={confirmation} onChange={event => setConfirmation(event.target.value)} required /></label>
                <button disabled={pending}>{pending ? "Kaydediliyor…" : "Şifremi kaydet"}</button>
                {error && <div>
                    <p role="alert">{error}</p>
                    <a href="/login">Giriş ekranına dön</a>
                </div>}
            </form> : token === "" ? <>
                <p>WhatsApp’tan aldığınız şifre oluşturma bağlantısını açın veya giriş ekranından şifre yenileme talebi gönderin.</p>
                <a href="/login">Giriş ekranına dön</a>
            </> : null}
        </section>
    </main>;
}
