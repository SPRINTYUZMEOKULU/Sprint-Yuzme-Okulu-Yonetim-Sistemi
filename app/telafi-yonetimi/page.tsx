import { requireProfile } from "@/lib/auth/profile";
import CompensationManagementClient from "./compensation-management-client";
export const dynamic="force-dynamic";
export default async function Page(){await requireProfile(["owner","admin","branch_manager"]);return <CompensationManagementClient/>}
