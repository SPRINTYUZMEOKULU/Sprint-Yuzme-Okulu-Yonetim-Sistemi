"use client";
import type { PortalCredential } from './portal-message';
// Only this browser's current page lifetime; never database/localStorage/logs.
const drafts = new Map<string, {
    value: PortalCredential;
    expires: number;
}>();
export function rememberPortalCredential(value: PortalCredential) {
    drafts.set(value.accountId, { value, expires: Date.now() + 15 * 60 * 1000 });
    window.dispatchEvent(new CustomEvent('portal-credential-changed', { detail: value.accountId }));
}
export function portalCredentialDraft(accountId: string, revision: string) {
    const draft = drafts.get(accountId);
    if (!draft || draft.expires <= Date.now() || draft.value.revision !== revision) {
        drafts.delete(accountId);
        return null;
    }
    return draft.value;
}
