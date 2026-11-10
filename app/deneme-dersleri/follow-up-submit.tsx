"use client";
import { useFormStatus } from "react-dom";
export default function FollowUpSubmit({children}:{children:React.ReactNode}) {
  const {pending}=useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Kaydediliyor…" : children}</button>;
}
