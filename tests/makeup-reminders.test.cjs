const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {stripTypeScriptTypes}=require('node:module');
const crypto=require('node:crypto');
function setup({passive=false,cancelled=false,changed=false,missingPhone=false,dbError=false}={}){
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
 const logs=new Map(); const writes=[];
 const data={student_compensation_lessons:[{id:'makeup',student_id:'student',target_group_id:'g',target_schedule_id:'s',lesson_date:date,status:'planned'}],students:[{id:'student',first_name:'Ege',last_name:'Örnek',guardian_phone:missingPhone?'':'05551112233',status:'active',is_active:true,is_deleted:false}],lesson_schedules:[{id:'s',group_id:'g',start_time:'23:57',end_time:'23:59'}],training_groups:[{id:'g',branch_id:'b',name:'Çocuk',course_type:'child'}],branches:[{id:'b',name:'Havuz'}],student_activity_logs:cancelled?[{student_id:'student',source_id:'s'}]:[]};
 if(passive)data.students=[];
 const db={from(table){let filters=[],mutation=null,payload;const q={select(){return q},eq(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},maybeSingle(){q.single=true;return q},insert(v){mutation='insert';payload=v;return q},update(v){mutation='update';payload=v;return q},then(resolve){let rows=table==='message_logs'?[...logs.values()]:data[table]||[];if(changed&&table==='student_compensation_lessons')rows=[];rows=rows.filter(r=>filters.every(([k,v])=>k.includes('->>')||!(k in r)||(Array.isArray(v)?v.includes(r[k]):r[k]===v)));if(mutation){writes.push({table,mutation});if(mutation==='insert'){if(logs.has(payload.id))return Promise.resolve({error:{code:'23505'}}).then(resolve);logs.set(payload.id,payload);rows=[payload];}else{rows=rows.map(r=>{const value={...r,...payload};logs.set(r.id,value);return value;});}}return Promise.resolve({data:q.single?(rows[0]||null):rows,error:dbError?{message:'offline'}:null}).then(resolve)}};return q;}};
 let code=stripTypeScriptTypes(fs.readFileSync('app/ders-operasyonlari/reminder-actions.ts','utf8'));
 code=code.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const mod=new Function('createHash','requireProfile','createClient','revalidatePath',code+';return {loadTodayMakeupReminders,makeupReminderAction};')(crypto.createHash,async()=>({id:'admin',organization_id:'org'}),async()=>db,()=>{});
 return {mod,logs,writes};
}
test('only current planned telafis; load is read-only; separate reminder message',async()=>{const s=setup();const rows=await s.mod.loadTodayMakeupReminders();assert.equal(rows.length,1);assert.match(rows[0].message,/bugün/);assert.match(rows[0].message,/23:57/);assert.equal(rows[0].recipient,'905551112233');assert.equal(s.writes.length,0);});
test('passive and cancelled lesson recipients excluded',async()=>{for(const opts of [{passive:true},{cancelled:true},{changed:true}])assert.deepEqual(await setup(opts).mod.loadTodayMakeupReminders(),[]);});
test('repeat prepares share one log; confirmation recorded only after prepare',async()=>{const s=setup();await assert.rejects(()=>s.mod.makeupReminderAction('makeup','confirm'));await s.mod.makeupReminderAction('makeup','prepare');await s.mod.makeupReminderAction('makeup','prepare');assert.equal(s.logs.size,1);assert.equal([...s.logs.values()][0].status,'prepared');await s.mod.makeupReminderAction('makeup','confirm');assert.equal([...s.logs.values()][0].status,'sent');assert.equal((await s.mod.loadTodayMakeupReminders())[0].sent,true);});
test('missing phone and changed plan block message actions',async()=>{await assert.rejects(()=>setup({missingPhone:true}).mod.makeupReminderAction('makeup','prepare'));await assert.rejects(()=>setup({changed:true}).mod.makeupReminderAction('makeup','confirm'));});
test('database failure cannot masquerade as an empty successful list',async()=>{await assert.rejects(()=>setup({dbError:true}).mod.loadTodayMakeupReminders());});
