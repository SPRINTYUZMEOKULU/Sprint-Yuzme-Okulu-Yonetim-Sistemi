const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/payments/bank-import.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsObject={};vm.runInNewContext(code,{exports:exportsObject,Date});const b=exportsObject;
for(const [input,expected] of [['4.000,00',4000],['4000,00 TL',4000],['4.000',4000],['4,000.00',4000],['4000.25',4000.25],['-1.250,50',-1250.5],['(1.000,00)',-1000],['',null],['USD 100',null],['1.2.3,00',null],['1234,567',null],['1,2,3',null],['ABC',null]])assert.equal(b.parseBankAmount(input),expected,String(input));
assert.equal(b.parseBankDate('15.10.2026'),'2026-10-14T21:00:00.000Z');assert.equal(b.parseBankDate('15.10.2026 14:05:06'),'2026-10-15T11:05:06.000Z');
assert.equal(b.parseBankDate('2026-10-15'),'2026-10-14T21:00:00.000Z');assert.equal(b.parseBankDate('31.02.2026'),null);assert.equal(b.parseBankDate('15.10.2026 25:00'),null);assert.equal(b.parseBankDate('garbage'),null);
const row={sourceRow:3,occurredAt:'2026-10-14T21:00:00.000Z',senderName:'Test Veli',amount:4000,description:'Test kurs ücreti',reference:'TEST-REF'};
assert.equal(b.validateBankRow(row),true);for(const change of [{amount:-4000},{amount:0},{amount:NaN},{amount:4000.125},{senderName:''},{sourceRow:0},{occurredAt:'invalid'}])assert.equal(b.validateBankRow({...row,...change}),false);
const students=[{id:'a',first_name:'İrem',last_name:'Işık',guardian_name:'Test Veli'},{id:'b',first_name:'İrem',last_name:'Işık',guardian_name:null}];
assert.equal(b.suggestBankStudents('Test Veli','',students).join(','),'a');assert.equal(b.suggestBankStudents('irem isik','',students).join(','),'a,b');assert.equal(b.suggestBankStudents('Other','İrem Işık yüzme',students).join(','),'a,b');assert.equal(b.suggestBankStudents('İrem','',students).length,0);
console.log('Bank import checks passed: Turkish/decimal amounts, invalid inputs, local dates, incoming rows and ambiguous name suggestions.');
const crypto=require('node:crypto');let ctx;
const routeCode=ts.transpileModule(fs.readFileSync('app/api/invoice-bank-import/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const routeExports={};
const db={from(table){return {table,insert:false,select(){return this},eq(key,value){if(this.table==='invoice_bank_entries'&&key==='organization_id')assert.equal(value,'org');return this},in(key,keys){this.keys=keys;return this},maybeSingle(){return Promise.resolve({data:ctx.active?{id:'actor'}:null,error:null})},upsert(entries){ctx.saved=entries;this.insert=true;return this},then(resolve,reject){return Promise.resolve({data:this.insert?[{id:'entry'}]:ctx.conflict?[{row_key:this.keys[0],content_key:'other'}]:[],error:null}).then(resolve,reject)}}}};
const deps={'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'node:crypto':crypto,'@/lib/auth/profile':{requireProfile:async()=>({id:'actor',organization_id:'org'})},'@/lib/payments/document-admin':{documentAdmin:()=>db},'@/lib/payments/bank-import':b};
vm.runInNewContext(routeCode,{exports:routeExports,require:id=>deps[id],Buffer,Map});
const body={incomingConfirmed:true,accountIban:b.PAYMENT_IBAN,fileHash:'a'.repeat(64),fileName:'test.csv',sheet:'Test',rows:[row]};
async function post(overrides={},state={}){ctx={active:true,saved:null,conflict:false,...state};return routeExports.POST({text:async()=>JSON.stringify({...body,...overrides})});}
(async()=>{
 let result=await post();assert.equal(result.status,200);assert.equal(result.body.saved,1);assert.equal(ctx.saved[0].organization_id,'org');assert.equal(ctx.saved[0].amount,4000);assert.equal(ctx.saved[0].imported_by,'actor');
 for(const change of [{incomingConfirmed:false},{accountIban:'OTHER'},{fileHash:'bad'},{rows:[]},{rows:[{...row,amount:-1}]}]){assert.equal((await post(change)).status,400);assert.equal(ctx.saved,null);}
 assert.equal((await post({}, {active:false})).status,403);assert.equal(ctx.saved,null);
 assert.equal((await post({}, {conflict:true})).status,409);assert.equal(ctx.saved,null);
 assert.equal((await post({rows:[row,{...row,amount:6000}]})).status,409);assert.equal(ctx.saved,null);
 console.log('Bank import API checks passed: account confirmation, validation, active user, organization-scoped insert and conflicting transaction reference rejection.');
})().catch(error=>{console.error(error);process.exitCode=1});
