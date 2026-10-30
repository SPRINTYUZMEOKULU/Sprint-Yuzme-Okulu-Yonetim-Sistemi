const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
const {XMLParser}=require('fast-xml-parser');
const m={exports:{}};
new Function('module','exports','require',ts.transpileModule(fs.readFileSync('lib/invoicing/isnet-esmm-test.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,n=>n==='server-only'?{}:require(n));
const {buildEsmmTestSend,buildEsmmTestSearch,parseIsnetEsmmReply,IsnetEsmmTestClient}=m.exports;
const id='11111111-1111-4111-8111-111111111111',code='SPRINT-TEST-'+id;
// Entirely synthetic local fixtures, never sent over the network.
function draft(){return {ettn:id,externalDocumentNumber:code,documentNumber:'TST2026000000001',documentDate:'2026-10-30T13:00:00+03:00',createdDate:'2026-10-30T13:00:00+03:00',note:'LOCAL TEST ONLY',receiver:{taxCode:'0000000000',name:'Synthetic & Co <test>',address:'Test address',city:'Test city',town:'Test town',taxOffice:'Test office',email:'test@example.invalid'},lines:[{productName:'Synthetic service',productDescription:'LOCAL TEST',grossAmount:'100.00',netAmount:'100.00',payableAmount:'120.00',stoppageTaxAmount:'0',stoppageTaxRate:'0',stoppageTaxableAmount:'100',totalTaxAmount:'20.00',vatTaxAmount:'20.00',vatTaxRate:'20',vatTaxableAmount:'100',witholdingTaxAmount:'0',witholdingTaxCode:'',witholdingTaxRate:'0',witholdingTaxableAmount:'0'}],grossAmount:'100',payableAmount:'120',totalAmount:'100',totalCollectedVatAmount:'20',totalStoppageAmount:'0',totalTaxAmount:'20',totalVatAmount:'20',totalWitholdingAmount:'0'};}
function reply(op,body){return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${op}Response xmlns="http://tempuri.org/"><${op}Result>${body}</${op}Result></${op}Response></s:Body></s:Envelope>`;}
test('SOAP e-SMM uses documented field order, namespaces, escaped recipient and stable external identity',()=>{
 const xml=buildEsmmTestSend('0000000000',draft());
 assert.match(xml,/Synthetic &amp; Co &lt;test&gt;/);assert.match(xml,/<a:CompanyTaxCode>0000000000<\/a:CompanyTaxCode><a:ESMM/);assert.match(xml,/<b:ExternalDocumentNumber>SPRINT-TEST-/);
 const names=[...xml.matchAll(/<b:([A-Za-z]+)>/g)].map(x=>x[1]);
 assert.ok(names.includes('CreatedDate'));assert.ok(names.indexOf('CreatedDate')<names.indexOf('CrossRate'));assert.ok(names.indexOf('DocumentDate')<names.indexOf('ETTN'));assert.ok(names.indexOf('GrossAmount')<names.indexOf('NetAmount'));
 new XMLParser().parse(`<root xmlns:a="model" xmlns:b="data">${xml}</root>`);
});
test('missing tax amounts, inconsistent totals and arbitrary external codes stop before transport',async()=>{
 let calls=0;const client=new IsnetEsmmTestClient('0000000000',async()=>{calls++;throw Error('must not send')});
 const d=draft();d.lines[0].vatTaxRate='';await assert.rejects(()=>client.send(d),e=>e.outcome==='not_sent');
 const changed=draft();changed.payableAmount='121';await assert.rejects(()=>client.send(changed),e=>e.outcome==='not_sent');
 const external=draft();external.externalDocumentNumber='other-code';await assert.rejects(()=>client.send(external),e=>e.outcome==='not_sent');assert.equal(calls,0);
});
test('test client sends once to the fixed sandbox and validates returned identity',async()=>{
 let calls=0;const d=draft();const client=new IsnetEsmmTestClient('0000000000',async(url,init)=>{calls++;assert.equal(url,m.exports.ISNET_ESMM_TEST_URL);assert.equal(init.redirect,'error');assert.match(init.body,/<SendESMM xmlns=/);return new Response(reply('SendESMM',`<Result>Success</Result><DocumentNumber>${d.documentNumber}</DocumentNumber><Ettn>${id}</Ettn><ExternalESMMCode>${code}</ExternalESMMCode>`));});
 assert.deepEqual(await client.send(d),{ettn:id,documentNumber:d.documentNumber,externalCode:code});assert.equal(calls,1);
});
test('timeout/unknown delivery never automatically resends; reconciliation keeps the same external code',async()=>{
 let calls=0;const client=new IsnetEsmmTestClient('0000000000',async()=>{calls++;throw Error('network with private payload')});await assert.rejects(()=>client.send(draft()),e=>e.outcome==='uncertain'&&!e.message.includes('private payload'));assert.equal(calls,1);
 const query=buildEsmmTestSearch('0000000000',code,true);assert.match(query,new RegExp(`<a:ExternalDocumentNumber>${code}`));assert.match(query,/<b:IsXMLIncluded>true/);
});
test('malformed XML, SOAP faults, DTD and provider rejection cannot become success',()=>{
 for(const xml of ['not XML',reply('SendESMM','<Result>Failed</Result>'),'<s:Envelope xmlns:s="soap"><s:Body><s:Fault/></s:Body></s:Envelope>','<!DOCTYPE x [<!ENTITY data SYSTEM "file:///etc/passwd">]><x/>'])assert.throws(()=>parseIsnetEsmmReply(xml,'SendESMM'));
});
test('a search cannot attach a different external document; empty results remain empty',async()=>{
 const make=body=>new IsnetEsmmTestClient('0000000000',async()=>new Response(reply('SearchESMM',body)));
 assert.deepEqual(await make('<Result>Success</Result><ESMM/>').search(code),[]);
 await assert.rejects(()=>make('<Result>Success</Result><ESMM><ESMM><ExternalDocumentNumber>other</ExternalDocumentNumber></ESMM></ESMM>').search(code),e=>e.outcome==='uncertain');
});

test('provider-required creation timestamp and calendar dates are validated before any send',()=>{
 const noCreation=draft();delete noCreation.createdDate;assert.throws(()=>buildEsmmTestSend('0000000000',noCreation),e=>e.outcome==='not_sent');
 const invalidDate=draft();invalidDate.createdDate='2026-02-30T13:00:00+03:00';assert.throws(()=>buildEsmmTestSend('0000000000',invalidDate),e=>e.outcome==='not_sent');
});

test('a successful provider reply without external code preserves canonical identity but cannot count as verified or resend',async()=>{
 let calls=0;const client=new IsnetEsmmTestClient('0000000000',async()=>{calls++;return new Response(reply('SendESMM',`<Result>Success</Result><DocumentNumber>AAB2026000000539</DocumentNumber><Ettn>${id}</Ettn><ExternalESMMCode/>`));});
 await assert.rejects(()=>client.send(draft()),e=>e.outcome==='uncertain'&&e.documentIdentity?.ettn===id&&e.documentIdentity?.documentNumber==='AAB2026000000539');assert.equal(calls,1);
});
test('ETTN recovery is read-only, keeps empty results unresolved, and rejects a different document',async()=>{
 let calls=0;const client=new IsnetEsmmTestClient('0000000000',async(_url,options)=>{calls++;assert.match(options.body,/<SearchESMM xmlns=/);assert.match(options.body,new RegExp(`<a:Ettn>${id}</a:Ettn>`));return new Response(reply('SearchESMM','<Result>Success</Result><ESMM/>'));});
 assert.deepEqual(await client.searchByEttn(id,true),[]);assert.equal(calls,1);
 const wrong=new IsnetEsmmTestClient('0000000000',async()=>new Response(reply('SearchESMM','<Result>Success</Result><ESMM><ESMM><ETTN>other-document</ETTN></ESMM></ESMM>')));await assert.rejects(()=>wrong.searchByEttn(id),e=>e.outcome==='uncertain');
});
