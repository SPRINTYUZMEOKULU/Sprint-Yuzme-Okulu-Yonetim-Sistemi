# Successful public pre-registration measurement

This implementation is NOT activated until configuration and end-to-end checks are complete.

## Dedicated conversion action

Create a website lead action named `Başarılı online ön kayıt`, primary, counting `One` per ad click. Copy its event snippet's complete `send_to` value into Vercel's `NEXT_PUBLIC_GOOGLE_ADS_PRE_REGISTRATION_SEND_TO` (format `AW-<tag id>/<label>`), then rebuild. A GA4 property ID, conversion action numeric ID, page-view action, or arbitrary existing signup action is not interchangeable with this value.

The browser emits the conversion only after an HTTP success AND a server-confirmed UUID studentId. Honeypot responses have no ID and produce no event. Google Ads transaction_id is derived from that UUID; repeats use the same value. No name, phone, email, course selection or health data enters the event. Internal/manual registration routes do not emit this conversion.

Basic consent mode: the Google tag is not loaded until the visitor explicitly opts in to the optional measurement checkbox. Analytics storage and ad personalization remain denied. Declining does not prevent registration. This does not implement enhanced conversions or offline imports.

## Attribution across domains — required before activation

All three landing sites forward to `kayit.sprintyuzmekursu.com/on-kayit`. Preserve existing UTM and Google click parameters (`gclid`, `wbraid`, `gbraid`, and the Google linker's `_gl`) through actual registration links and redirects; do not overwrite existing query strings. Configure the same Google tag and cross-domain linking with the landing sites' consent integration, then test real navigation in a browser. Consent choices must not be assumed to carry across unrelated domains.

UTM source/medium/campaign arriving at the form are saved in the existing registration consent snapshot and activity log JSON, marked `verification: visitor_declared`. `google_ads_utm` is a diagnostic candidate channel, NOT proof of an attributable paid conversion. It must never be presented as verified sponsored traffic. Google Ads determines attributable conversions, including its conversion window and attribution model. Do not filter the conversion event to UTM visitors only, since returning visitors may still have a valid earlier ad interaction.

## Release checklist

- Verify dedicated action's snippet and count/primary settings; review campaign goals so page views or contact clicks do not masquerade as successful registrations.
- Test all three landing-to-form links preserving click identifiers and UTM.
- Test no-consent and declined-consent paths: no Google tag request/event.
- With consent, verify exactly one conversion for a server-confirmed form success using Tag Assistant and a test environment; no event for failed requests, validation errors, honeypot responses or internal entries.
- Verify duplicate student ID keeps the same transaction_id; a different ID remains a distinct event.
- Confirm Google Ads diagnostics and attribution after reporting delay. No historical/manual records should be imported as sponsored conversions.

Official references:
- https://support.google.com/google-ads/answer/3438531
- https://support.google.com/google-ads/answer/6386790
- https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic
- https://developers.google.com/tag-platform/devguides/cross-domain
