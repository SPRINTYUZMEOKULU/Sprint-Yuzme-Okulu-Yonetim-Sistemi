const guardianPages=new Set(['/veli-paneli','/veli-devam','/veli-gelisim','/veli-odemeler','/veli-mesajlar','/veli-duyurular','/veli-belgeler','/veli-talepleri','/veli-hesabim','/portal-rehberi']);
/** Keep the return path inside the signed-in user's own application surface. */
export function loginDestination(role:string,next?:string|null){
 const fallback=role==='guardian'?'/veli-paneli':'/';
 if(!next||!next.startsWith('/')||next.startsWith('//')||/[\\\u0000-\u0020]/.test(next)||/%(?:2f|5c)/i.test(next))return fallback;
 try{
  const url=new URL(next,'https://sprint.invalid');
  if(url.origin!=='https://sprint.invalid'||['/login','/yetkisiz','/auth/signout'].includes(url.pathname)||url.pathname.startsWith('/api/'))return fallback;
  if(role==='guardian'){
   if(!guardianPages.has(url.pathname))return fallback;
   // Management preview links are not guardian sessions.
   url.searchParams.delete('previewGuardian');
  }
  return url.pathname+url.search+url.hash;
 }catch{return fallback;}
}
