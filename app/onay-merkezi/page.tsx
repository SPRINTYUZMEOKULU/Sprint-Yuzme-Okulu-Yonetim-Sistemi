import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import ApprovalCenterClient from "./approval-center-client-v2";
import ApprovedArchiveFinalizer from "./approved-archive-finalizer";
import "./approval-center-premium.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ permanentDelete?: string }>;

export default async function ApprovalCenterPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const params = await searchParams;

  if (!["owner", "admin", "branch_manager"].includes(profile.role)) {
    redirect("/yetkisiz");
  }

  const canPermanentlyDelete = ["owner", "admin"].includes(profile.role);
  const permanentDeleteOpen = canPermanentlyDelete && params.permanentDelete === "1";

  return (
    <>
      <ApprovalCenterClient />

      {canPermanentlyDelete ? (
        <div className="approvalDangerLauncher">
          <div>
            <span>YÖNETİCİ ARAÇLARI</span>
            <strong>Kalıcı silme işlemleri normal onay akışından ayrı tutulur.</strong>
          </div>
          <Link href={permanentDeleteOpen ? "/onay-merkezi" : "/onay-merkezi?permanentDelete=1"}>
            {permanentDeleteOpen ? "Kalıcı Silmeyi Kapat" : "Kalıcı Silmeyi Aç"}
          </Link>
        </div>
      ) : null}

      {permanentDeleteOpen ? <ApprovedArchiveFinalizer /> : null}

      <style>{`
        .approvalDangerLauncher{
          width:min(1236px,calc(100% - 44px));
          margin:16px auto 30px;
          padding:12px 15px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          border:1px solid #e2e8f0;
          border-radius:14px;
          background:#fff;
          box-shadow:0 6px 18px rgba(15,35,65,.035);
          font-family:Arial,sans-serif;
        }
        .approvalDangerLauncher>div{display:grid;gap:3px}
        .approvalDangerLauncher span{font-size:9px;font-weight:950;letter-spacing:.12em;color:#b42318}
        .approvalDangerLauncher strong{font-size:12px;color:#53657d}
        .approvalDangerLauncher a{
          min-height:36px;
          padding:0 13px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border:1px solid #efc2c7;
          border-radius:10px;
          background:#fff;
          color:#b4233a;
          text-decoration:none;
          font-size:12px;
          font-weight:900;
          white-space:nowrap;
        }
        @media(max-width:720px){
          .approvalDangerLauncher{width:calc(100% - 24px);flex-direction:column;align-items:stretch}
          .approvalDangerLauncher a{width:100%}
        }
      `}</style>
    </>
  );
}
