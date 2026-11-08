"use client";

export default function RegistrationError({reset}:{reset:()=>void}) {
  return <main style={{maxWidth:560,margin:"48px auto",padding:24,fontFamily:"system-ui",lineHeight:1.6}}>
    <h1>Ön kayıt formu şu anda yüklenemedi</h1>
    <p role="alert">Bağlantıyı kontrol edip yeniden deneyin. Bu ekran yeni bir başvuru oluşturmaz.</p>
    <button type="button" onClick={reset} style={{padding:"12px 20px",font:"inherit",cursor:"pointer"}}>Yeniden dene</button>
  </main>;
}
