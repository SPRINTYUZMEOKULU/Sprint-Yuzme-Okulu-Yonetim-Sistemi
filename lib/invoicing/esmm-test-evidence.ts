import "server-only";
import { XMLValidator } from "fast-xml-parser";

/**
 * Evidence gate for a previously submitted synthetic İşNet TEST e-SMM.
 * NOT a sender, NOT a status poller, NOT authorization to enable production.
 * Values must be independently confirmed from the provider's SearchESMM reply.
 */
export type EsmmTestEvidence = {
  expectedEttn: string;
  searchedEttn: string;
  expectedDocumentNumber: string;
  returnedDocumentNumber: string;
  reportStatus: string;
  xml: string;
  pdf: Uint8Array;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const number=/^[A-Z0-9]{1,32}$/;
export function verifyEsmmGibTestEvidence(e: EsmmTestEvidence) {
 const problems:string[]=[];
 if(!uuid.test(e.expectedEttn)||e.expectedEttn!==e.searchedEttn) problems.push("Sorgulanan ETTN uyuşmuyor.");
 if(!number.test(e.expectedDocumentNumber)||e.expectedDocumentNumber!==e.returnedDocumentNumber) problems.push("Makbuz numarası uyuşmuyor.");
 if(e.reportStatus!=="GibRaporuKabulEtti") problems.push("İşNet GİB rapor kabul durumu doğrulanmadı.");
 if(typeof e.xml!=="string"||e.xml.length<80||e.xml.length>3*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(e.xml)||XMLValidator.validate(e.xml)!==true) problems.push("Test XML doğrulanamadı.");
 // The XML must contain the same exact ETTN and document number, not just an unrelated well-formed response.
 const ettnPattern=new RegExp("<(?:[A-Za-z][\\w.-]*:)?ETTN>\\s*"+e.expectedEttn+"\\s*</(?:[A-Za-z][\\w.-]*:)?ETTN>","i");
 const numberPattern=new RegExp("<(?:[A-Za-z][\\w.-]*:)?(?:makbuzNo|DocumentNumber)>\\s*"+e.expectedDocumentNumber+"\\s*</(?:[A-Za-z][\\w.-]*:)?(?:makbuzNo|DocumentNumber)>","i");
 if(typeof e.xml==="string"&&(!ettnPattern.test(e.xml)||!numberPattern.test(e.xml))) problems.push("Test XML belge kimliği sorgu kaydıyla uyuşmuyor.");
 if(!(e.pdf instanceof Uint8Array)||e.pdf.length<32||e.pdf.length>3*1024*1024||Buffer.from(e.pdf.subarray(0,5)).toString()!=="%PDF-") problems.push("Test PDF doğrulanamadı.");
 return {accepted:problems.length===0,problems};
}
