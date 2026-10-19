"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function PendingSubmitButton({
  children,
  pendingText = "Kaydediliyor…",
  className,
  disabled = false,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      type="submit"
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? pendingText : children}
    </button>
  );
}
