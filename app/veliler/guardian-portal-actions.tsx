"use client";
import PortalCredentialManager from './portal-credential-manager';
export default function GuardianPortalActions({guardianProfileId,phone,hasGuardianRow,linkedCount}:{guardianProfileId:string;phone:string;hasGuardianRow:boolean;linkedCount:number}) {
 return <div><PortalCredentialManager accountId={guardianProfileId}/>{!hasGuardianRow?<p>Portal ana kaydı eksik. Önce hesap bağlantısını tamamlayın.</p>:null}{!linkedCount?<p>Kursiyer bağlantısı bulunmuyor.</p>:null}{!phone?<p>Telefon bilgisi eksik.</p>:null}</div>;
}
