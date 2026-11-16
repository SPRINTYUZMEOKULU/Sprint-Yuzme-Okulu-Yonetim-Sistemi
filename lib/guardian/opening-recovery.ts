export function isStalePortalChunk(error:unknown){
 const message=typeof error==='string'?error:error instanceof Error?error.message:String((error as any)?.message||'');
 return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);
}
export function allowPortalReload(storage:Pick<Storage,'getItem'|'setItem'>,now=Date.now()){
 try{const previous=Number(storage.getItem('sprint:portal-reload')||0);if(previous&&now-previous<60000)return false;storage.setItem('sprint:portal-reload',String(now));return true;}catch{return false;}
}
