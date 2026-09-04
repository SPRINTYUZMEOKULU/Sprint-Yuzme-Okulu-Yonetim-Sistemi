import type { ReactNode } from "react";
import WhatsAppGroupPolicy from "./whatsapp-group-policy";

export default function RegistrationCompletionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <WhatsAppGroupPolicy />
      {children}
    </>
  );
}
