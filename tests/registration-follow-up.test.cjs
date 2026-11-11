const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function load(path, stubs = {}) { const out={exports:{}}; new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(out,out.exports,n=>stubs[n] || require(n)); return out.exports; }
const course = load('lib/registrations/course-type.ts');
const follow = load('lib/registrations/follow-up.ts');
const policy=load('lib/registrations/trial-policy.ts');
const availability=load('lib/registrations/trial-availability.ts',{'./trial-policy':policy});
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
const youngBirth=`${new Date().getUTCFullYear()-5}-01-01`;
test('package keys match group labels without crossing course types',()=>{
  for (const [key,label] of [['team','Takım / Performans'],['child','Çocuk Yüzme Kursu'],['adult','Yetişkin Yüzme Kursu'],['private','Özel Ders']]) assert.equal(course.packageMatchesCourse(key,label),true);
  assert.equal(course.packageMatchesCourse('child','Yetişkin Yüzme Kursu'),false);
  assert.equal(course.packageMatchesCourse('team','Çocuk Yüzme Kursu'),false);
  assert.equal(course.packageMatchesCourse(null,'Takım / Performans'),true);
  assert.equal(course.packageMatchesCourse('unknown','team'),false);
});
test('follow-up cannot be cleared by a different request, older consent or empty result',()=>{
 const c={contact_request:'call_me',accepted_at:'2026-11-10T12:00:00Z'};
 const log={new_value:{contact_request:'call_me',consent_accepted_at:c.accepted_at,resolution:'Veliyle görüşüldü'}};
 assert.equal(follow.contactResolved(c,[]),false);
 assert.equal(follow.contactResolved(c,[log]),true);
 assert.equal(follow.contactResolved({...c,accepted_at:'2026-11-11T12:00:00Z'},[log]),false);
 assert.equal(follow.contactResolved({...c,contact_request:'whatsapp_info'},[log]),false);
 assert.equal(follow.contactResolved(c,[{new_value:{...log.new_value,resolution:''}}]),false);
 assert.equal(follow.contactResolved({contact_request:'ready_to_start'},[]),true);
});
function fixture({status='pre_registration',trial=null,birthDate=youngBirth,registrationFor='child',groupType='Takım / Performans'}={}) {
 const writes=[];
 const db={students:[{id:'student',organization_id:'org',status,first_name:'Test',last_name:'Çocuk',birth_date:birthDate,guardian_phone:'05551112233',phone:'05559998877'}],message_logs:[],registration_consents:[{student_id:'student',organization_id:'org',contact_request:'call_me',registration_for:registrationFor,accepted_at:'today'}],training_groups:[{id:'group',organization_id:'org',is_active:true,name:'Takım',branch_id:'branch',course_type:groupType}],student_activity_logs:trial?[{id:'12345678-1234-1234-1234-123456789012',student_id:'student',organization_id:'org',activity_type:'trial_lesson',new_value:trial}]:[]};
 const supabase={from(table){let filters=[],one=false; const q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},order(){return q},limit(){return q},single(){one=true;return q},maybeSingle(){one=true;return q},insert(value){writes.push({table,value});return Promise.resolve({error:null})},then(resolve){const rows=db[table].filter(row=>filters.every(f=>f(row)));return Promise.resolve({data:one?(rows[0]||null):rows,error:null}).then(resolve)}};return q}};
 const actions=load('app/deneme-dersleri/actions.ts',{'@/lib/auth/profile':{requireProfile:async()=>({id:'staff',organization_id:'org'})},'@/lib/supabase/server':{createClient:async()=>supabase},'next/cache':{revalidatePath(){}},'next/navigation':{redirect(url){throw new Error('REDIRECT '+decodeURIComponent(url))}},'@/lib/guardian/registration-owner':load('lib/guardian/registration-owner.ts'),'@/lib/registrations/trial-policy':policy,'@/lib/registrations/trial-availability':availability,'@/lib/registrations/course-type':course,'@/lib/dates/display':{formatDisplayDateTime:()=> 'Tarih'},'@/lib/registrations/follow-up':follow});
 const form=(values)=>{const f=new FormData();for(const [k,v] of Object.entries({student_id:'student',...values}))f.set(k,v);return f};
 return {...actions,writes,form,db};
}
test('trial planning writes only an activity, never an enrollment or payment',async()=>{
 const f=fixture();await assert.rejects(f.recordCandidateFollowUp(f.form({kind:'trial',trial_status:'planned',group_id:'group',scheduled_at:tomorrow+'T18:00',trial_approval_confirmed:'on',note:'Nefes kontrolü'})),/REDIRECT/);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].table,'student_activity_logs');assert.equal(f.writes[0].value.new_value.scheduled_at,tomorrow+'T15:00:00.000Z');assert.equal(f.writes[0].value.activity_type,'trial_lesson');
});
test('trial result requires a planned trial and meaningful assessment',async()=>{
 const f=fixture();await assert.rejects(f.recordCandidateFollowUp(f.form({kind:'trial',trial_status:'attended',note:'Geldi, uygun'})),/Önce/);assert.equal(f.writes.length,0);
 const g=fixture({trial:{status:'planned',approved_at:'today',scheduled_at:'2099-11-10T15:00:00Z',group_id:'group'}});await assert.rejects(g.recordCandidateFollowUp(g.form({kind:'trial',trial_status:'attended',note:'x'})),/en az/);assert.equal(g.writes.length,0);
 await assert.rejects(g.recordCandidateFollowUp(g.form({kind:'trial',trial_status:'attended',note:'Seviyesi uygun'})),/REDIRECT/);assert.equal(g.writes[0].value.new_value.group_id,'group');assert.equal(g.writes[0].value.new_value.status,'attended');
});
test('contact result binds to current consent; active students cannot use candidate workflow',async()=>{
 const f=fixture();await assert.rejects(f.recordCandidateFollowUp(f.form({kind:'contact',note:'Veli arandı'})),/REDIRECT/);assert.equal(f.writes[0].value.new_value.consent_accepted_at,'today');
 const g=fixture({status:'active'});await assert.rejects(g.recordCandidateFollowUp(g.form({kind:'contact',note:'Veli arandı'})),/Bekleyen/);assert.equal(g.writes.length,0);
});

test('school approval is explicit and cannot issue a second trial for the same child',async()=>{const f=fixture();await assert.rejects(f.recordCandidateFollowUp(f.form({kind:'trial',trial_status:'planned',group_id:'group',scheduled_at:tomorrow+'T18:00'})),/açıkça onaylayınız/);assert.equal(f.writes.length,0);const g=fixture({trial:{status:'attended'}});await assert.rejects(g.recordCandidateFollowUp(g.form({kind:'trial',trial_status:'planned',group_id:'group',scheduled_at:tomorrow+'T18:00',trial_approval_confirmed:'on'})),/yalnızca bir deneme/);assert.equal(g.writes.length,0)});
test('message preparation refuses unapproved and cancelled trials and never marks an approval sent',async()=>{assert.equal((await fixture({trial:{status:'planned'}}).approvedTrialMessage('student')).ok,false);assert.equal((await fixture({trial:{status:'cancelled',approved_at:'today'}}).approvedTrialMessage('student')).ok,false);const f=fixture({trial:{status:'planned',approved_at:'today',group_name:'Çocuk',scheduled_at:tomorrow+'T15:00:00Z'}});const r=await f.approvedTrialMessage('student');assert.equal(r.ok,true);assert.equal(r.sent,false);assert.equal(r.recipient,'905551112233');assert.match(r.message,/onaylanmıştır/);assert.equal(f.writes.length,0)});

test('a scheduled lesson without school approval cannot be marked attended',async()=>{const f=fixture({trial:{status:'planned'}});await assert.rejects(f.recordCandidateFollowUp(f.form({kind:'trial',trial_status:'attended',note:'Kursiyer geldi'})),/Okul onayı/);assert.equal(f.writes.length,0)});

test('school approval accepts adults and older children without an age or course-type limit',async()=>{for(const options of [{birthDate:'1980-01-01',registrationFor:'adult',groupType:'Yetişkin Yüzme Kursu'},{birthDate:'2010-01-01'},{birthDate:null}]){const f=fixture(options);await assert.rejects(f.recordCandidateFollowUp(f.form({kind:'trial',trial_status:'planned',group_id:'group',scheduled_at:tomorrow+'T18:00',trial_approval_confirmed:'on'})),/REDIRECT/);assert.equal(f.writes.length,1);assert.equal(f.writes[0].value.new_value.approved_by,'staff')}});
test('adult trial confirmation uses the course participant phone and salutation',async()=>{const f=fixture({birthDate:'1980-01-01',registrationFor:'adult',trial:{status:'planned',approved_at:'today',group_name:'Yetişkin',scheduled_at:tomorrow+'T15:00:00Z'}});const r=await f.approvedTrialMessage('student');assert.equal(r.ok,true);assert.equal(r.recipient,'905559998877');assert.match(r.message,/Değerli Kursiyerimiz/);assert.doesNotMatch(r.message,/Sayın Velimiz/)});
