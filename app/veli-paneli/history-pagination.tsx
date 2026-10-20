import Link from 'next/link';
export default function HistoryPagination({path,page,hasNext,child,previewGuardian}:{path:string;page:number;hasNext:boolean;child:string;previewGuardian?:string}){
 if(page===1&&!hasNext)return null;
 const href=(next:number)=>{const params=new URLSearchParams({child,page:String(next)});if(previewGuardian)params.set('previewGuardian',previewGuardian);return `${path}?${params}`;};
 return <nav className="guardianHistoryPagination" aria-label="Geçmiş kayıt sayfaları">{page>1?<Link href={href(page-1)} prefetch={false}>Önceki Sayfa</Link>:<span/>}<span>Sayfa {page}</span>{hasNext?<Link href={href(page+1)} prefetch={false}>Sonraki Sayfa</Link>:<span/>}</nav>;
}
