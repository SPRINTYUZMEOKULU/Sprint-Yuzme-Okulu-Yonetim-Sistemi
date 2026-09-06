import type { ReactNode } from "react";
import WhatsAppGroupPolicy from "./whatsapp-group-policy";
import BirthAgeEnhancer from "./birth-age-enhancer";

export default function RegistrationCompletionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <WhatsAppGroupPolicy />
      {children}
      <BirthAgeEnhancer />
    </>
  );
}
