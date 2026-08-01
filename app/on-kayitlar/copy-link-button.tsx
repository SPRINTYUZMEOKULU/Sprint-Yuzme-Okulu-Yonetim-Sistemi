"use client";
import { useState } from "react";
export default function CopyLinkButton({ url }: { url: string }) {
  const [copied,setCopied]=useState(false);
  async function copy(){ await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(()=>setCopied(false),1800); }
  return <button type="button" onClick={copy} className="primaryOperation">{copied?"Link kopyalandı ✓":"Ön Kayıt Linkini Kopyala"}</button>;
}
