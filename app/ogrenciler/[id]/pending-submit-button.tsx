"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function PendingSubmitButton({
  children,
  pendingText = "Kaydediliyor…",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingText : children}
    </button>
  );
}
