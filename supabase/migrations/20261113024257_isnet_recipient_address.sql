-- Structured recipient address for İşNet's separate CityName/TownName fields.
-- Nullable additions preserve previously collected documents and payment links.
alter table public.payment_document_requests
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists postal_code text;

comment on column public.payment_document_requests.city is 'Recipient-supplied city; never inferred from a student branch or bank payment.';
comment on column public.payment_document_requests.district is 'Recipient-supplied district for the provider TownName field.';
comment on column public.payment_document_requests.postal_code is 'Optional recipient postal code; no existing address is parsed or backfilled.';
