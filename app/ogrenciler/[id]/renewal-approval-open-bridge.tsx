"use client";

import { useEffect } from "react";

export default function RenewalApprovalOpenBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("renewalApproval") !== "approved") return;

    const requestId = params.get("renewalRequestId") || undefined;
    const body = document.body;
    body.classList.add("renewalDirectOpenPending");

    const veil = document.createElement("div");
    veil.className = "renewalDirectOpenVeil";
    veil.innerHTML = `
      <div class="renewalDirectOpenCard" role="status" aria-live="polite">
        <div class="renewalDirectOpenSpinner" aria-hidden="true"></div>
        <strong>Onaylı yenileme hazırlanıyor…</strong>
        <span>Öğrenci dosyası yerine doğrudan Kayıt Yenileme Merkezi açılacak.</span>
      </div>
    `;
    document.body.appendChild(veil);

    let tries = 0;
    let timer = 0;

    const cleanupUrl = () => {
      params.delete("renewalApproval");
      params.delete("renewalRequestId");
      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", cleanUrl);
    };

    const finish = () => {
      window.clearTimeout(timer);
      body.classList.remove("renewalDirectOpenPending");
      veil.remove();
      cleanupUrl();
    };

    const open = () => {
      if (document.querySelector(".renewalOverlay")) {
        finish();
        return;
      }

      window.dispatchEvent(
        new CustomEvent("sprint:open-renewal", {
          detail: { requestId },
        }),
      );

      tries += 1;
      if (tries < 30) {
        timer = window.setTimeout(open, 180);
      } else {
        body.classList.remove("renewalDirectOpenPending");
        veil.innerHTML = `
          <div class="renewalDirectOpenCard error" role="alert">
            <strong>Yenileme merkezi açılamadı.</strong>
            <span>Sayfayı yenileyip tekrar deneyin veya öğrenci dosyasındaki “Kayıt Yenile” düğmesini kullanın.</span>
            <button type="button" data-renewal-retry>Tekrar Dene</button>
          </div>
        `;
        veil.querySelector<HTMLButtonElement>("[data-renewal-retry]")?.addEventListener("click", () => {
          tries = 0;
          body.classList.add("renewalDirectOpenPending");
          open();
        });
      }
    };

    timer = window.setTimeout(open, 80);

    const style = document.createElement("style");
    style.textContent = `
      body.renewalDirectOpenPending{overflow:hidden!important}
      .renewalDirectOpenVeil{position:fixed;inset:0;z-index:1505;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#071f3f,#0b5d9f);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .renewalDirectOpenCard{width:min(440px,92vw);display:grid;justify-items:center;gap:10px;padding:28px 24px;border:1px solid rgba(255,255,255,.22);border-radius:22px;background:rgba(255,255,255,.10);color:#fff;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.25);backdrop-filter:blur(10px)}
      .renewalDirectOpenCard strong{font-size:20px}.renewalDirectOpenCard span{color:#dce9f6;font-size:13px;line-height:1.5}.renewalDirectOpenCard.error{background:#fff;color:#173b5e}.renewalDirectOpenCard.error span{color:#60758a}.renewalDirectOpenCard button{min-height:44px;margin-top:4px;padding:0 16px;border:0;border-radius:11px;background:#0b65aa;color:#fff;font-weight:900;cursor:pointer}
      .renewalDirectOpenSpinner{width:38px;height:38px;border:4px solid rgba(255,255,255,.28);border-top-color:#fff;border-radius:50%;animation:renewalDirectSpin .75s linear infinite}
      @keyframes renewalDirectSpin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);

    return () => {
      window.clearTimeout(timer);
      body.classList.remove("renewalDirectOpenPending");
      veil.remove();
      style.remove();
    };
  }, []);

  return null;
}
