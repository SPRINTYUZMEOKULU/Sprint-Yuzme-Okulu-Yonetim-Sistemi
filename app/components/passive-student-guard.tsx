"use client";

import { useRef, type ReactNode, type MouseEvent, type FormEvent } from "react";

/** Shared guard: the server-provided student status remains the source of truth. */
export default function PassiveStudentGuard({ status, name, children, explicitOnly = false }: {
  status?: string | null; name: string; children: ReactNode; explicitOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<(() => void) | null>(null);
  const replaying = useRef(false);
  const passive = ["passive", "pasif"].includes((status || "").toLowerCase());

  function ask(event: MouseEvent | FormEvent, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    pending.current = action;
    dialog.current?.showModal();
  }

  function close(continueAction: boolean) {
    const action = pending.current;
    pending.current = null;
    dialog.current?.close();
    if (continueAction && action) {
      replaying.current = true;
      try { action(); } finally { replaying.current = false; }
    }
  }

  return <div style={{ display: "contents" }}
    onClickCapture={(event) => {
      if (!passive || replaying.current || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>(explicitOnly ? "[data-student-action]" : "button, input[type=submit], a[href^='https://wa.me'], a[href^='mailto:'], a[href^='tel:']");
      if (!control || control.closest("dialog[data-passive-warning], .studentFileTabs, .heroTopActions") || control.matches(":disabled, [type=reset], [role=tab]")) return;
      const label = (control.getAttribute("aria-label") || control.textContent || "").trim();
      if (/^(kapat|vazgeç|iptal|geri|←|×|daralt|tamamını gör)$/i.test(label)) return;
      // Submission is checked once in onSubmitCapture, including keyboard submission.
      if ((control instanceof HTMLButtonElement && control.type === "submit" && control.form) || (control instanceof HTMLInputElement && control.type === "submit")) return;
      ask(event, () => { if (control.isConnected) control.click(); });
    }}
    onSubmitCapture={(event) => {
      if (!passive || replaying.current || explicitOnly) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      ask(event, () => { if (form.isConnected) form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined); });
    }}>
    {children}
    {passive && <dialog ref={dialog} data-passive-warning aria-labelledby="passive-warning-title" aria-describedby="passive-warning-text" onCancel={() => { pending.current = null; }} style={{ border: "1px solid #fecaca", borderRadius: 18, padding: 24, maxWidth: "min(420px, calc(100vw - 32px))", color: "#17233b" }}>
      <h2 id="passive-warning-title" style={{ margin: "0 0 12px", fontSize: 19, color: "#b91c1c" }}>Pasif öğrenci uyarısı</h2>
      <p id="passive-warning-text">{name}: Pasif öğrenci üzerinde işlem yapıyorsunuz. Devam etmek istiyor musunuz?</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button type="button" autoFocus onClick={() => close(false)} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white" }}>Vazgeç</button>
        <button type="button" onClick={() => close(true)} style={{ padding: "12px 16px", borderRadius: 10, border: 0, background: "#b91c1c", color: "white", fontWeight: 700 }}>Devam et</button>
      </div>
    </dialog>}
  </div>;
}
