-- Server routes validate the signed-in profile, organization and student access.
-- These content tables previously lacked privileges for their server-side client.
-- Keep RLS and existing authenticated/anonymous privileges unchanged.
begin;
grant select, insert, update on public.announcements, public.guardian_documents to service_role;
grant select, insert on public.guardian_consents to service_role;
commit;
