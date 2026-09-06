import type { ReactNode } from "react";
import WhatsAppGroupPolicy from "./whatsapp-group-policy";
import BirthAgeEnhancer from "./birth-age-enhancer";
import RegistrationMobileCohesion from "./registration-mobile-cohesion";
import DueConfirmationEnhancer from "./due-confirmation-enhancer";

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
      <RegistrationMobileCohesion />
      <DueConfirmationEnhancer />
    </>
  );
}
