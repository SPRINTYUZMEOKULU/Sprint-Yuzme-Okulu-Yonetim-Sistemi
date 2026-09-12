import type { ReactNode } from "react";
import OperationProfessionalEnhancer from "./operation-professional-enhancer";
import "./operation-professional.css";

export default function OperasyonPlaniLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OperationProfessionalEnhancer />
      {children}
    </>
  );
}
