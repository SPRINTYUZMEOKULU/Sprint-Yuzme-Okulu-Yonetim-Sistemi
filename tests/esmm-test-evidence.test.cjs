const test=require("node:test");
const assert=require("node:assert/strict");
const ts=require("typescript");
const fs=require("fs");
const mod={exports:{}};
new Function("module","exports","require",ts.transpileModule(fs.readFileSync("lib/invoicing/esmm-test-evidence.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports,n=>n==="server-only"?{}:require(n));
const {verifyEsmmGibTestEvidence}=mod.exports;
const id="22222222-2222-4222-8222-222222222222",number="TST2026000000007";
const draft=()=>({expectedEttn:id,searchedEttn:id,expectedDocumentNumber:number,returnedDocumentNumber:number,reportStatus:"GibRaporuKabulEtti",xml:`<?xml version="1.0"?><eArsivVeri><serbestMeslekMakbuz><makbuzNo>${number}</makbuzNo><ETTN>${id}</ETTN></serbestMeslekMakbuz></eArsivVeri>`,pdf:Buffer.from("%PDF-1.4\nSynthetic test bytes -- not an actual provider PDF -- trailer")});
test("synthetic matching acceptance evidence can pass offline",()=>assert.equal(verifyEsmmGibTestEvidence(draft()).accepted,true));
test("a SendESMM success or report pending can never pass",()=>{
 const d=draft();d.reportStatus="Success";assert.equal(verifyEsmmGibTestEvidence(d).accepted,false);
 const v=draft();v.reportStatus="GibRaporuGonderildi";assert.equal(verifyEsmmGibTestEvidence(v).accepted,false);
});
test("different ETTN or number cannot pass",()=>{
 const d=draft();d.searchedEttn="33333333-3333-4333-8333-333333333333";assert.equal(verifyEsmmGibTestEvidence(d).accepted,false);
 const v=draft();v.returnedDocumentNumber="TST2026000000008";assert.equal(verifyEsmmGibTestEvidence(v).accepted,false);
});
test("PDF/XML format and XML identity are checked",()=>{
 const a=draft();a.pdf=Buffer.from("not PDF");assert.equal(verifyEsmmGibTestEvidence(a).accepted,false);
 const b=draft();b.xml=b.xml.replace(id,"33333333-3333-4333-8333-333333333333");assert.equal(verifyEsmmGibTestEvidence(b).accepted,false);
 const c=draft();c.xml='<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x/>';assert.equal(verifyEsmmGibTestEvidence(c).accepted,false);
});
