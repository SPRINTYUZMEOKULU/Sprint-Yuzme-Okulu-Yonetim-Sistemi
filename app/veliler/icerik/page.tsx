import GuardianContentManagement from "./settings-content";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) { return <GuardianContentManagement searchParams={searchParams}/>; }
