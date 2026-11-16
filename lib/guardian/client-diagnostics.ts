export const portalScreens=['/veli-paneli','/veli-devam','/veli-gelisim','/veli-odemeler','/veli-mesajlar','/veli-duyurular','/veli-belgeler','/veli-talepleri','/veli-hesabim','/login'] as const;
export const portalErrorCategories=['chunk','storage','realtime','dom','unsupported','render','other'] as const;
export type PortalClientDiagnostic={screen:string;category:string;reactCode:number|null;browser:'safari'|'chromium'|'firefox'|'other'};
export function portalDiagnostic(error:unknown,path:string,userAgent=''):PortalClientDiagnostic|null{
 const screen=path.split(/[?#]/)[0];if(!(portalScreens as readonly string[]).includes(screen))return null;
 const message=typeof error==='string'?error:String((error as any)?.message||'');
 const category=/ChunkLoadError|Loading chunk|dynamically imported module|module script failed/i.test(message)?'chunk':/localStorage|sessionStorage|quota|storage|SecurityError/i.test(message)?'storage':/websocket|realtime/i.test(message)?'realtime':/removeChild|insertBefore|NotFoundError/i.test(message)?'dom':/not a function|not supported|is not defined/i.test(message)?'unsupported':/Minified React error|hydration|Rendered (more|fewer) hooks/i.test(message)?'render':'other';
 const react=message.match(/Minified React error #(\d{1,4})/);
 const browser=/Firefox|FxiOS/i.test(userAgent)?'firefox':/Chrome|Chromium|CriOS|Edg/i.test(userAgent)?'chromium':/Safari/i.test(userAgent)?'safari':'other';
 return {screen,category,reactCode:react?Number(react[1]):null,browser};
}
const lastReports=new Map<string,number>();
export function reportPortalClientError(error:unknown){
 try{
  const diagnostic=portalDiagnostic(error,window.location.pathname,navigator.userAgent);if(!diagnostic)return;
  const key=diagnostic.screen+':'+diagnostic.category,now=Date.now();if(now-(lastReports.get(key)||0)<60000)return;lastReports.set(key,now);
  // Only fixed categories, route names and an optional public React error number.
  // Never transmit exception messages, stacks, query strings, account IDs or credentials.
  void fetch('/api/portal-client-errors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(diagnostic),keepalive:true}).catch(()=>{});
 }catch{/* Error reporting must never interfere with opening the portal. */}
}
