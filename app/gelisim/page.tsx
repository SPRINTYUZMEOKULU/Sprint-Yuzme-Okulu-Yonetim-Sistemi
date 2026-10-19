import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{child?:string}>}) {const {child}=await searchParams;redirect('/veli-gelisim'+(child?'?child='+encodeURIComponent(child):''));}
