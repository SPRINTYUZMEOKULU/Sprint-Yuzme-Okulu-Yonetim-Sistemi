import { readSettings, settingsAdmin } from "./server";
export async function publicRegistrationSettings() {
  const db = settingsAdmin();
  const { data, error } = await db.from("organizations").select("id").eq("name", "Sprint Yüzme Okulu").single();
  if (error || !data) throw Error("Kurum bilgileri alınamadı.");
  const [brand, registration] = await Promise.all([readSettings(db, data.id, "kurum"), readSettings(db, data.id, "kayit")]);
  return { brand: brand.values, registration: registration.values };
}
