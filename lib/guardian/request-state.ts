export const requestStatusLabels: Record<string,string> = {new:'Yeni',reviewing:'İnceleniyor',approval_pending:'Yönetici Onayı',answered:'Yanıtlandı',resolved:'Çözüldü',rejected:'Reddedildi',archived:'Arşivlendi'};
export function responseState(status:string,response:string|null,previous:string|null){
 const changed=Boolean(response && response!==previous);
 return {changed,status:changed&&['new','reviewing','answered'].includes(status)?'answered':status};
}
