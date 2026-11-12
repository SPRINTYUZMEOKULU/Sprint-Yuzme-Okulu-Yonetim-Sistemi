"use client";

type GoogleTag = (...args: unknown[]) => void;
declare global {
  interface Window { dataLayer?: unknown[][]; gtag?: GoogleTag; }
}

// Configure only with the dedicated successful-registration action's snippet.
const destination = process.env.NEXT_PUBLIC_GOOGLE_ADS_PRE_REGISTRATION_SEND_TO || "";
export const registrationMeasurementConfigured = /^AW-\d+\/[A-Za-z0-9_-]+$/.test(destination);
let initialized = false;
const queued = new Set<string>();

export function enableRegistrationMeasurement() {
  if (!registrationMeasurementConfigured) return;
  if (initialized) {
    window.gtag?.("consent", "update", { ad_storage: "granted", ad_user_data: "granted" });
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function (...args: unknown[]) {
    // Google's loader expects the command arguments object, not a nested array.
    window.dataLayer!.push(arguments as unknown as unknown[]);
  };
  window.gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied",
    ad_personalization: "denied", analytics_storage: "denied",
  });
  window.gtag("consent", "update", {
    ad_storage: "granted", ad_user_data: "granted",
    ad_personalization: "denied", analytics_storage: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", destination.split("/")[0], { send_page_view: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${destination.split("/")[0]}`;
  document.head.appendChild(script);
  initialized = true;
}

export function disableRegistrationMeasurement() {
  if (!initialized) return;
  window.gtag?.("consent", "update", {
    ad_storage: "denied", ad_user_data: "denied",
    ad_personalization: "denied", analytics_storage: "denied",
  });
}

export function reportSuccessfulRegistration(result: unknown, consent: boolean) {
  if (!consent || !registrationMeasurementConfigured || !result || typeof result !== "object") return false;
  const response = result as Record<string, unknown>;
  // Honeypot, failed requests, page views and button clicks cannot reach this event.
  if (response.ok !== true || typeof response.studentId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.studentId)) return false;
  const transactionId = `pre-registration-${response.studentId}`;
  if (queued.has(transactionId)) return false;
  enableRegistrationMeasurement();
  window.gtag?.("event", "conversion", {
    send_to: destination, transaction_id: transactionId,
  });
  queued.add(transactionId);
  return true;
}
