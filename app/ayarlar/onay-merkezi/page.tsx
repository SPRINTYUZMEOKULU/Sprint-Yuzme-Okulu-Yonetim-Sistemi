import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import {
  updateApprovalRuleField,
  setModuleApprovalDefaults,
} from "./actions";

export const dynamic = "force-dynamic";

type ApprovalRule = {
  id: string;
  rule_key: string;
  title: string;
  module: string;
  requires_approval: boolean;
  dashboard_notification: boolean;
  push_notification: boolean;
  is_active: boolean;
};

const MODULE_LABELS: Record<string, string> = {
  finance: "Finans ve Kasa",
  students: "Öğrenci İşlemleri",
  enrollment: "Kayıt ve Paket",
  attendance: "Yoklama ve Telafi",
  staff: "Personel ve Yetkiler",
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  finance:
    "Ödeme, vade tarihi ve kasa teslimi gibi finans işlemlerini yönetin.",
  students:
    "Öğrenci silme, pasife alma ve kritik bilgi değişikliklerini yönetin.",
  enrollment:
    "Kayıt dondurma, iptal, şube, grup, paket ve ders hakkı değişikliklerini yönetin.",
  attendance:
    "Yoklama ve telafi işlemlerindeki kritik değişiklikleri yönetin.",
  staff:
    "Personel silme, pasife alma ve rol/yetki değişikliklerini yönetin.",
};

function moduleIcon(module: string) {
  switch (module) {
    case "finance":
      return "💳";
    case "students":
      return "👤";
    case "enrollment":
      return "📋";
    case "attendance":
      return "✅";
    case "staff":
      return "👥";
    default:
      return "⚙️";
  }
}

export default async function ApprovalSettingsPage() {
  const profile = await requireProfile(["owner", "admin"]);

  const organizationId = profile.organization_id;

  if (!organizationId) {
    return (
      <main className="approvalSettingsPage">
        <div className="approvalSettingsContainer">
          <header className="approvalHeader">
            <p>SPRİNTOS · AYARLAR</p>
            <h1>Onay Merkezi</h1>
            <span>Organizasyon bilgisi bulunamadı.</span>
          </header>
        </div>
      </main>
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("approval_rules")
    .select(
      "id,rule_key,title,module,requires_approval,dashboard_notification,push_notification,is_active"
    )
    .eq("organization_id", organizationId)
    .order("module", { ascending: true })
    .order("title", { ascending: true });

  const rules = (data || []) as ApprovalRule[];

  const grouped = rules.reduce<Record<string, ApprovalRule[]>>(
    (acc, rule) => {
      if (!acc[rule.module]) acc[rule.module] = [];
      acc[rule.module].push(rule);
      return acc;
    },
    {}
  );

  const moduleOrder = [
    "finance",
    "students",
    "enrollment",
    "attendance",
    "staff",
  ];

  const approvalCount = rules.filter(
    (rule) => rule.is_active && rule.requires_approval
  ).length;

  const dashboardCount = rules.filter(
    (rule) => rule.is_active && rule.dashboard_notification
  ).length;

  const pushCount = rules.filter(
    (rule) => rule.is_active && rule.push_notification
  ).length;

  return (
    <main className="approvalSettingsPage">
      <div className="approvalSettingsContainer">
        <header className="approvalHeader">
          <div>
            <p>SPRİNTOS · AYARLAR</p>
            <h1>Onay Merkezi</h1>
            <span>
              Kritik işlemlerde yönetici onayı, ana ekran bildirimi ve
              telefon push tercihlerinin tamamını tek merkezden yönetin.
            </span>
          </div>

          <div className="headerActions">
            <Link href="/ayarlar">← Ayarlara Dön</Link>
            <Link href="/onay-merkezi">Bekleyen Onaylar →</Link>
          </div>
        </header>

        {error ? (
          <section className="errorCard">
            Onay kuralları yüklenemedi: {error.message}
          </section>
        ) : null}

        <section className="summaryGrid">
          <article>
            <span>Toplam Kural</span>
            <strong>{rules.length}</strong>
          </article>

          <article>
            <span>Yönetici Onayı Açık</span>
            <strong>{approvalCount}</strong>
          </article>

          <article>
            <span>Ana Panel Bildirimi</span>
            <strong>{dashboardCount}</strong>
          </article>

          <article>
            <span>Telefon Push Seçili</span>
            <strong>{pushCount}</strong>
          </article>
        </section>

        <section className="infoCard">
          <strong>Merkezi çalışma mantığı</strong>
          <p>
            Bir işlem için “Yönetici Onayı” açıksa personelin yaptığı kritik
            değişiklik doğrudan uygulanmaz; Onay Merkezi’ne talep olarak düşer.
            Yönetici onayladığında işlem uygulanır. “Ana Panel Bildirimi”
            açıksa olay ana ekrana düşer. “Telefon Push” tercihi ise PWA push
            altyapısı bağlandığında aynı olay için telefon bildirimi üretir.
          </p>
        </section>

        {moduleOrder.map((module) => {
          const moduleRules = grouped[module] || [];

          if (!moduleRules.length) return null;

          return (
            <section className="moduleCard" key={module}>
              <div className="moduleHeader">
                <div className="moduleTitle">
                  <div className="moduleIcon">{moduleIcon(module)}</div>

                  <div>
                    <p>ONAY GRUBU</p>
                    <h2>{MODULE_LABELS[module] || module}</h2>
                    <span>
                      {MODULE_DESCRIPTIONS[module] ||
                        "Bu modülün onay kurallarını yönetin."}
                    </span>
                  </div>
                </div>

                <div className="moduleActions">
                  <form action={setModuleApprovalDefaults}>
                    <input type="hidden" name="module" value={module} />
                    <input type="hidden" name="mode" value="secure" />
                    <button type="submit">Tümünü Güvenli Yap</button>
                  </form>

                  <form action={setModuleApprovalDefaults}>
                    <input type="hidden" name="module" value={module} />
                    <input type="hidden" name="mode" value="notify" />
                    <button type="submit" className="secondaryButton">
                      Sadece Bildirim
                    </button>
                  </form>
                </div>
              </div>

              <div className="rulesTableWrap">
                <table className="rulesTable">
                  <thead>
                    <tr>
                      <th>İşlem</th>
                      <th>Aktif</th>
                      <th>Yönetici Onayı</th>
                      <th>Ana Panel Bildirimi</th>
                      <th>Telefon Push</th>
                    </tr>
                  </thead>

                  <tbody>
                    {moduleRules.map((rule) => (
                      <tr key={rule.id}>
                        <td>
                          <strong>{rule.title}</strong>
                          <small>{rule.rule_key}</small>
                        </td>

                        <td>
                          <RuleToggle
                            rule={rule}
                            field="is_active"
                            checked={rule.is_active}
                          />
                        </td>

                        <td>
                          <RuleToggle
                            rule={rule}
                            field="requires_approval"
                            checked={rule.requires_approval}
                          />
                        </td>

                        <td>
                          <RuleToggle
                            rule={rule}
                            field="dashboard_notification"
                            checked={rule.dashboard_notification}
                          />
                        </td>

                        <td>
                          <RuleToggle
                            rule={rule}
                            field="push_notification"
                            checked={rule.push_notification}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        <section className="nextStepCard">
          <div>
            <strong>Telefon bildirimleri</strong>
            <p>
              Push anahtarları burada hazır. Bir sonraki aşamada PWA servis
              worker, cihaz aboneliği ve push gönderim katmanını bağladığımızda
              seçili olaylar telefon kilit ekranına kadar gönderilebilecek.
            </p>
          </div>
        </section>
      </div>

      <style>{`
        .approvalSettingsPage {
          min-height: 100vh;
          background: #f4f7fb;
          padding: 34px 24px 70px;
        }

        .approvalSettingsContainer {
          width: min(1260px, 100%);
          margin: 0 auto;
        }

        .approvalHeader {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .approvalHeader p,
        .moduleTitle p {
          margin: 0 0 6px;
          color: #176de9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .11em;
        }

        .approvalHeader h1 {
          margin: 0;
          color: #10213a;
          font-size: 30px;
          line-height: 1.1;
        }

        .approvalHeader span {
          display: block;
          margin-top: 8px;
          color: #64748b;
          max-width: 760px;
          line-height: 1.6;
        }

        .headerActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .headerActions a {
          background: #fff;
          color: #10213a;
          border: 1px solid #dbe5f1;
          border-radius: 12px;
          padding: 10px 14px;
          text-decoration: none;
          font-weight: 800;
          white-space: nowrap;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .summaryGrid article,
        .infoCard,
        .moduleCard,
        .nextStepCard,
        .errorCard {
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 18px;
        }

        .summaryGrid article {
          padding: 18px;
        }

        .summaryGrid span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .summaryGrid strong {
          font-size: 24px;
          color: #10213a;
        }

        .infoCard,
        .nextStepCard,
        .errorCard {
          padding: 16px 18px;
          margin-bottom: 16px;
        }

        .infoCard {
          border-color: #bfdbfe;
          background: #eff6ff;
        }

        .infoCard strong,
        .nextStepCard strong {
          color: #10213a;
        }

        .infoCard p,
        .nextStepCard p {
          margin: 7px 0 0;
          color: #5b6b82;
          line-height: 1.6;
          font-size: 13px;
        }

        .errorCard {
          color: #b42318;
          border-color: #fecaca;
          background: #fff1f2;
        }

        .moduleCard {
          overflow: hidden;
          margin-bottom: 16px;
        }

        .moduleHeader {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          padding: 18px;
          border-bottom: 1px solid #e8eef6;
        }

        .moduleTitle {
          display: flex;
          gap: 13px;
          align-items: flex-start;
        }

        .moduleIcon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 13px;
          background: #eff6ff;
          font-size: 20px;
          flex: 0 0 auto;
        }

        .moduleTitle h2 {
          margin: 0;
          color: #10213a;
          font-size: 18px;
        }

        .moduleTitle span {
          display: block;
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .moduleActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .moduleActions button {
          border: 0;
          border-radius: 10px;
          background: #176de9;
          color: #fff;
          padding: 9px 11px;
          cursor: pointer;
          font-weight: 800;
        }

        .moduleActions .secondaryButton {
          background: #eef2f7;
          color: #334155;
        }

        .rulesTableWrap {
          overflow-x: auto;
        }

        .rulesTable {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
        }

        .rulesTable th,
        .rulesTable td {
          padding: 14px 16px;
          border-bottom: 1px solid #edf2f7;
          text-align: center;
          vertical-align: middle;
        }

        .rulesTable th {
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .rulesTable th:first-child,
        .rulesTable td:first-child {
          text-align: left;
          width: 42%;
        }

        .rulesTable td strong {
          display: block;
          color: #10213a;
          font-size: 13px;
        }

        .rulesTable td small {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          margin-top: 4px;
        }

        .toggleForm {
          display: inline-flex;
        }

        .toggleButton {
          min-width: 70px;
          border-radius: 999px;
          border: 1px solid #dbe5f1;
          padding: 7px 10px;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .toggleButton.on {
          border-color: #bbf7d0;
          background: #ecfdf3;
          color: #047857;
        }

        @media (max-width: 900px) {
          .approvalHeader,
          .moduleHeader {
            flex-direction: column;
          }

          .headerActions,
          .moduleActions {
            width: 100%;
            justify-content: flex-start;
          }

          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .approvalSettingsPage {
            padding: 22px 14px 60px;
          }

          .summaryGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function RuleToggle({
  rule,
  field,
  checked,
}: {
  rule: ApprovalRule;
  field:
    | "is_active"
    | "requires_approval"
    | "dashboard_notification"
    | "push_notification";
  checked: boolean;
}) {
  return (
    <form action={updateApprovalRuleField} className="toggleForm">
      <input type="hidden" name="ruleId" value={rule.id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={checked ? "false" : "true"} />

      <button
        type="submit"
        className={`toggleButton ${checked ? "on" : ""}`}
        title={`${rule.title}: ${checked ? "Açık" : "Kapalı"}`}
      >
        {checked ? "Açık" : "Kapalı"}
      </button>
    </form>
  );
}
