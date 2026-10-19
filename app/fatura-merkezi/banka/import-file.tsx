"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {WorkBook} from "xlsx";
import {MAX_BANK_ROWS,PAYMENT_IBAN,parseBankAmount,parseBankDate,type BankImportRow} from "@/lib/payments/bank-import";
type Mapping={date:string;sender:string;amount:string;description:string;reference:string};
type Preview={sourceRow:number;row:BankImportRow|null;error:string;selected:boolean};
const empty:Mapping={date:"",sender:"",amount:"",description:"",reference:""};
export default function ImportFile() {
  const [book,setBook]=useState<WorkBook|null>(null);const [sheet,setSheet]=useState("");const [grid,setGrid]=useState<string[][]>([]);const [header,setHeader]=useState(1);const [mapping,setMapping]=useState<Mapping>(empty);const [fileHash,setHash]=useState("");const [fileName,setName]=useState("");const [preview,setPreview]=useState<Preview[]>([]);const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const router=useRouter();
  async function selectSheet(wb:WorkBook,name:string) {const xlsx=await import("xlsx");const rows=xlsx.utils.sheet_to_json<string[]>(wb.Sheets[name],{header:1,defval:"",raw:false,dateNF:"dd.mm.yyyy"});setSheet(name);setGrid(rows);setHeader(1);setMapping(empty);setPreview([]);setConfirmed(false);}
  async function load(file:File|undefined) {
    setPreview([]);setConfirmed(false);setMessage("");setBook(null);setGrid([]);setMapping(empty);
    if(!file)return;
    if(!/\.(xlsx|xls|csv)$/i.test(file.name)||file.size>5*1024*1024){setMessage("En fazla 5 MB boyutunda Excel (.xlsx/.xls) veya CSV seçiniz.");return;}
    setBusy(true);
    try{const bytes=await file.arrayBuffer();const hash=await crypto.subtle.digest("SHA-256",bytes);setHash(Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join(""));const xlsx=await import("xlsx");const wb=xlsx.read(bytes,{type:"array",sheetRows:MAX_BANK_ROWS+27,cellFormula:false,cellHTML:false});if(!wb.SheetNames.length)throw Error("Çalışma sayfası yok.");setBook(wb);setName(file.name);await selectSheet(wb,wb.SheetNames[0]);}catch{setMessage("Dosya okunamadı. Bankadan Excel veya CSV olarak yeniden dışarı aktarınız.");}finally{setBusy(false);}
  }
  function prepare() {
    setConfirmed(false);setMessage("");
    if(!mapping.date||!mapping.sender||!mapping.amount){setMessage("Tarih, gönderen ve gelen tutar sütunlarını seçiniz.");return;}
    const source=grid.slice(header).map((cells,i)=>({cells,sourceRow:header+i+1})).filter(x=>x.cells.some(value=>String(value).trim()));
    if(source.length>MAX_BANK_ROWS){setMessage("Bir yüklemede en fazla 500 hareket işlenir. Dosyayı tarih aralıklarına bölerek yeniden yükleyiniz.");return;}
    const cell=(cells:string[],key:keyof Mapping)=>mapping[key]?String(cells[Number(mapping[key])-1]||"").trim():"";
    const result=source.map(({cells,sourceRow}):Preview=>{
      const amount=parseBankAmount(cell(cells,"amount"));const occurredAt=parseBankDate(cell(cells,"date"));const senderName=cell(cells,"sender");
      const error=amount===null?"Tutar okunamadı":amount<=0?"Gelen ödeme değil / sıfır":!occurredAt?"Tarih okunamadı":senderName.length<2?"Gönderen adı eksik":"";
      return {sourceRow,error,selected:!error,row:error?null:{sourceRow,amount:amount!,occurredAt:occurredAt!,senderName,description:cell(cells,"description"),reference:cell(cells,"reference")}};
    });setPreview(result);
  }
  async function save() {
    const rows=preview.filter(x=>x.selected&&x.row).map(x=>x.row);
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/invoice-bank-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows,fileHash,fileName,sheet,accountIban:PAYMENT_IBAN,incomingConfirmed:confirmed})});const data=await response.json();if(!response.ok)throw Error(data.message||"Kaydedilemedi.");setMessage(`${data.saved} hareket kaydedildi; ${data.skipped} tekrar kayıt eklenmedi. ${data.message}`);setPreview([]);setConfirmed(false);router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"Kaydedilemedi.");}finally{setBusy(false);}
  }
  const headings=grid[header-1]||[];const selected=preview.filter(x=>x.selected&&x.row);const rejected=preview.length-selected.length;
  return <section className="invoice-card"><h2>VakıfBank Excel / CSV Yükle</h2><p>Dosya tarayıcıda okunur. Yalnızca seçtiğiniz hareket bilgileri kontrol kuyruğuna kaydedilir. İlk adımda fatura kesilmez ve kasaya yeni tahsilat yazılmaz.</p><label>Hesap hareketi dosyası<input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>void load(e.target.files?.[0])}/></label>
    {book?<><div className="invoice-grid"><label>Çalışma sayfası<select value={sheet} disabled={busy} onChange={e=>void selectSheet(book,e.target.value)}>{book.SheetNames.map(s=><option key={s}>{s}</option>)}</select></label><label>Sütun başlıklarının bulunduğu satır<input type="number" min={1} max={25} value={header} onChange={e=>{setHeader(Math.max(1,Math.min(25,Number(e.target.value)||1)));setPreview([]);setMapping(empty);setConfirmed(false);}}/></label></div>
    <p>Alacak / hesaba giriş sütununu seçiniz. Tek işaretli tutar sütunu varsa pozitif değerlerin hesaba giriş olduğunu doğrulayınız. Bakiye sütununu seçmeyiniz.</p><div className="invoice-grid">{([["date","İşlem tarihi"],["sender","Gönderen adı"],["amount","Gelen tutar / alacak"],["description","Açıklama (isteğe bağlı)"],["reference","İşlem / dekont no (önerilir)"]] as const).map(([key,label])=><label key={key}>{label}<select value={mapping[key]} onChange={e=>{setMapping({...mapping,[key]:e.target.value});setPreview([]);setConfirmed(false);}}><option value="">Sütun seçiniz</option>{headings.map((text,i)=><option key={i} value={String(i+1)}>{i+1}. {String(text||"Başlıksız").slice(0,100)}</option>)}</select></label>)}</div><button onClick={prepare} disabled={busy}>Önizlemeyi Hazırla</button></>:null}
    {preview.length?<><h3>{selected.length} hareket seçili · {rejected} satır dışarıda</h3><p>Seçili toplam: {selected.reduce((sum,x)=>sum+Math.round(x.row!.amount*100),0)/100} TL. Hatalı, borç ve sıfır tutarlı satırlar alınmaz. İstemediğiniz satırın işaretini kaldırınız.</p><div className="invoice-table-wrap"><table><thead><tr><th>Seç</th><th>Satır / tarih</th><th>Gönderen</th><th>Tutar / kontrol</th><th>Açıklama / referans</th></tr></thead><tbody>{preview.map((item,i)=><tr key={item.sourceRow}><td><input type="checkbox" aria-label={`${item.sourceRow}. satırı dahil et`} disabled={!item.row||busy} checked={item.selected} onChange={e=>{setPreview(preview.map((x,j)=>j===i?{...x,selected:e.target.checked}:x));setConfirmed(false);}}/></td><td>{item.sourceRow}<br/>{item.row?new Date(item.row.occurredAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"}):""}</td><td>{item.row?.senderName||"—"}</td><td>{item.error||`${item.row?.amount.toLocaleString("tr-TR")} TL`}</td><td>{item.row?.description}<br/>{item.row?.reference}</td></tr>)}</tbody></table></div><label className="invoice-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Dosyanın VakıfBank TR14 … 4815 06 hesabına ait olduğunu, seçilen {selected.length} satırın TRY cinsinden hesaba giriş olduğunu ve dışarıda kalan {rejected} satırı kontrol ettiğimi onaylıyorum.</span></label><button className="primary" disabled={busy||!confirmed||!selected.length} onClick={()=>void save()}>{busy?"Kaydediliyor…":"Seçilenleri Kontrol Kuyruğuna Kaydet"}</button></>:null}<p role="status">{message}</p>
  </section>;
}
