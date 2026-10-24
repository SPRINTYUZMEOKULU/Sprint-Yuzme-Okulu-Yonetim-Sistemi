/** UTM is a visitor-declared source, not verified Google Ads attribution. */
export function sanitizeRegistrationAttribution(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const safe = (key: string) => typeof input[key] === "string"
    ? (input[key] as string).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120)
    : "";
  const source = safe("source").toLowerCase();
  const medium = safe("medium").toLowerCase();
  const campaign = safe("campaign");
  if (!source && !medium && !campaign) return null;
  return {
    source, medium, campaign,
    channel: source === "google" && ["cpc", "ppc", "paidsearch"].includes(medium)
      ? "google_ads_utm" : "other_utm",
    verification: "visitor_declared" as const,
  };
}
