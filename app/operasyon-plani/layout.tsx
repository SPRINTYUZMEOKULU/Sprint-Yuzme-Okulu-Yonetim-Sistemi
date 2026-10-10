import type { ReactNode } from "react";
import OperationLiveRefresh from "./operation-live-refresh";
import OperationProfessionalEnhancer from "./operation-professional-enhancer";
import "./operation-professional.css";

export default function OperasyonPlaniLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OperationProfessionalEnhancer />
      <OperationLiveRefresh />
      {children}
    </>
  );
}
