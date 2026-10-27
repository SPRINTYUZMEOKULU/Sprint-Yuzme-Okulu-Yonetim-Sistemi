const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/notifications/cash-target.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);
const target=m.exports.cashNotificationTarget;
test('cash receipts and handover events target the same payment',()=>{
 for(const event_key of ['payment_received','cash_handover_requested','cash_handover_approved']){
  assert.equal(target({event_key,entity_id:'payment-A',metadata:{payment_method:'cash'}}),'/kasa?paymentId=payment-A');
 }
});
test('legacy notification metadata identifies the payment, never the open student',()=>{
 assert.equal(target({notification_type:'cash_handover_requested',source_id:'payment-B',metadata:{student_id:'student-A'}}),'/kasa?paymentId=payment-B');
 assert.equal(target({event_key:'cash_handover_requested',entity_id:'old',metadata:{payment_id:'correct'}}),'/kasa?paymentId=correct');
});
test('card and bank receipts retain their existing payment flow',()=>{
 for(const payment_method of ['card','bank_transfer','eft'])assert.equal(target({event_key:'payment_received',entity_id:'payment',metadata:{payment_method}}),null);
 assert.equal(target({event_key:'unrelated'}),null);
});
test('missing identity opens the pending queue and safely encodes identifiers',()=>{
 assert.equal(target({event_key:'cash_handover_requested'}),'/kasa?durum=handoff_pending');
 assert.equal(target({event_key:'cash_handover_approved',entity_id:'a&date=x'}),'/kasa?paymentId=a%26date%3Dx');
});
