"use client";
import {useState} from 'react';
export default function GuideActions(){
 const [copied,setCopied]=useState(false),[error,setError]=useState('');
 async function copy(){try{await navigator.clipboard.writeText(window.location.origin+'/portal-rehberi');setCopied(true);setError('');}catch{setError('Rehberin bağlantısını tarayıcınızın adres çubuğundan kopyalayabilirsiniz.');}}
 function print(){
  const details=Array.from(document.querySelectorAll<HTMLDetailsElement>('.portalGuideFaq details'));
  const previous=details.map(item=>item.open);
  details.forEach(item=>{item.open=true;});
  const restore=()=>{details.forEach((item,index)=>{item.open=previous[index];});};
  window.addEventListener('afterprint',restore,{once:true});
  window.print();
 }
 return <div className="portalGuideActions"><a href="/login" className="portalGuidePrimary">Portala Giriş Yap →</a><button type="button" onClick={()=>void copy()}>{copied?'Bağlantı Kopyalandı':'Rehber Bağlantısını Kopyala'}</button><button type="button" onClick={print}>Yazdır / PDF Kaydet</button>{error&&<p role="status">{error}</p>}</div>;
}
