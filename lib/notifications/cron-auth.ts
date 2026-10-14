import { createHash, timingSafeEqual } from "node:crypto";
export function authorizedCron(header:string|null,secret:string|undefined){
 if(!secret||secret.length<32||!header)return false;
 return timingSafeEqual(createHash('sha256').update(header).digest(),createHash('sha256').update(`Bearer ${secret}`).digest());
}
