import PermissionsSettingsContent from "./settings-content";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function Page({ searchParams }: {
  searchParams: Promise<{ profile?: string | string[] }>;
}) {
  const { profile } = await searchParams;
  return <PermissionsSettingsContent initialProfileId={typeof profile === "string" ? profile : undefined} />;
}
