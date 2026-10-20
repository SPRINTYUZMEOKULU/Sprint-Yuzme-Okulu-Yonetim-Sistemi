'use client';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import './veli.css';
export default function PortalError({reset}:{error:Error;reset:()=>void}){
 const params=useSearchParams(),query=new URLSearchParams();
 const child=params.get('child'),preview=params.get('previewGuardian');
 if(child)query.set('child',child);if(preview)query.set('previewGuardian',preview);
 return <main className="guardianShell"><div className="guardianContent" style={{paddingTop:60}}><section className="guardianEmpty" role="alert"><span className="guardianPill orange">Geçici bağlantı sorunu</span><h1>Bu ekran yüklenemedi</h1><p>Bilgiler şu anda alınamıyor. Tekrar deneyebilir veya genel bakışa dönebilirsiniz.</p><div style={{display:'flex',justifyContent:'center',flexWrap:'wrap',gap:12,marginTop:22}}><button type="button" className="guardianPortalButton" onClick={reset}>Tekrar Dene</button><Link className="guardianPortalButton" href={`/veli-paneli${query.size?`?${query}`:''}`}>Genel Bakışa Dön</Link></div></section></div></main>;
}
