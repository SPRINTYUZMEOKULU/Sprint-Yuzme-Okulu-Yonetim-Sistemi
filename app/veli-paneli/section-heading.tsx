import { GuardianIcon } from "./guardian-ui";
import "./section-heading.css";

type SectionIcon = "calendar" | "bell" | "document" | "progress" | "message" | "wallet";

export default function GuardianSectionHeading({icon, title, description}: {
  icon: SectionIcon;
  title: string;
  description: string;
}) {
  return <header className="portalSectionHeading">
    <span className="portalSectionIcon"><GuardianIcon name={icon} size={24}/></span>
    <div><h1>{title}</h1><p>{description}</p></div>
  </header>;
}
