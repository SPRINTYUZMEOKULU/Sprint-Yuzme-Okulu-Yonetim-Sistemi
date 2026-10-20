const portalRoutes=new Set(['/veli-paneli','/veli-devam','/veli-gelisim','/veli-odemeler','/veli-mesajlar','/veli-duyurular','/veli-belgeler','/veli-talepleri']);
export function guardianNotificationPath(value:unknown):string|null{
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return null;
 try{const url=new URL(value,'https://portal.invalid');if(url.origin!=='https://portal.invalid'||!portalRoutes.has(url.pathname))return null;return url.pathname+url.search+url.hash;}catch{return null;}
}
export function visibleGuardianNotification(row:any,studentIds:string[]){
 const path=guardianNotificationPath(row.target_path);if(!path)return false;
 const child=new URL(path,'https://portal.invalid').searchParams.get('child');
 return (!row.student_id||studentIds.includes(row.student_id))&&(!child||studentIds.includes(child));
}
