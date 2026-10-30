"use client";
import {useEffect,useState} from "react";
export default function StudentRenewalButton(){
 const [label,setLabel]=useState("Kayıt Yenile"),[checking,setChecking]=useState(false);
 useEffect(()=>{const update=(event:Event)=>{const value=(event as CustomEvent<{label:string;state:string}>).detail;if(value){setLabel(value.label);setChecking(value.state==="checking");}};window.addEventListener("sprint:renewal-button-state",update);return()=>window.removeEventListener("sprint:renewal-button-state",update);},[]);
 return <button type="button" data-renewal-button="1" className="renewalQuickButton" disabled={checking} onClick={()=>window.dispatchEvent(new CustomEvent("sprint:open-renewal"))}><span aria-hidden="true">↻</span> {label}</button>;
}
