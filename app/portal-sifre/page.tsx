import type { Metadata } from "next";
import SetupForm from "./setup-form";

export const metadata: Metadata = {
    title: "Portal şifrenizi oluşturun | SPRINT",
    referrer: "no-referrer",
    robots: { index: false, follow: false },
};

export default function PortalPasswordPage() {
    return <SetupForm />;
}
