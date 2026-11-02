"use server";
import { archivePreRegistration } from "@/app/on-kayitlar/actions";
export async function deactivateRegistrationCandidate(formData: FormData) {
  return archivePreRegistration(formData);
}
