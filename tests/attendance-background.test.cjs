const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(p){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,n=>{if(n==='@/lib/notifications/create-notification')return {createNotification(){throw Error('real sender forbidden in test')}};return n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('./')?load(require('node:path').join(require('node:path').dirname(p),n)+'.ts'):require(n)});return m.exports;}
const {authorizedCron}=load('lib/notifications/cron-auth.ts');const {runAttendanceBackground}=load('lib/notifications/attendance-background.ts');
test('missing, short, forged or absent cron credentials are rejected',()=>{assert.equal(authorizedCron(null,undefined),false);assert.equal(authorizedCron('Bearer undefined',undefined),false);assert.equal(authorizedCron('Bearer short','short'),false);assert.equal(authorizedCron('Bearer '+'a'.repeat(32),'b'.repeat(32)),false);assert.equal(authorizedCron('Bearer '+'a'.repeat(32),'a'.repeat(32)),true)});
function fixture(cancelled=false){const org='org';const tables={organization_settings:[],branches:[{id:'b',organization_id:org,is_active:true}],training_groups:[{id:'g',organization_id:org,is_active:true,name:'Meltem'}],lesson_schedules:[{id:'s',organization_id:org,group_id:'g',branch_id:'b',weekday:3,is_active:true,start_time:'21:00',end_time:'22:00'}],students:[{id:'a',organization_id:org,status:'active',is_deleted:false}],student_enrollments:[{id:'e',organization_id:org,student_id:'a',group_id:'g',status:'active',start_date:'2026-10-01',lesson_weekdays:[3],total_lessons:8,used_lessons:7}],student_group_memberships:[{id:'m',organization_id:org,student_id:'a',group_id:'g',is_active:true}],student_compensation_lessons:[],attendance_records:[],student_activity_logs:cancelled?[{id:'c',organization_id:org,student_id:'a',source_id:'s',activity_type:'lesson_cancellation_compensation',old_value:{cancelled_lesson_date:'2026-10-14'}}]:[],system_notifications:[]};const client={from(table){if(!tables[table])throw Error("Unknown test table: "+table);let rows=tables[table],offset=0,end=499;const filters=[];let single=false,updates;const q={select(){return q},maybeSingle(){single=true;return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,vs){filters.push(r=>vs.includes(r[k]));return q},contains(k,value){filters.push(r=>Object.entries(value).every(([a,b])=>r[k]?.[a]===b));return q},order(){return q},limit(n){end=offset+n-1;return q},range(a,b){offset=a;end=b;return q},or(){return q},update(values){updates=values;return q},then(resolve){if(updates)rows.filter(r=>filters.every(f=>f(r))).forEach(r=>Object.assign(r,updates));return Promise.resolve({data:single?(rows.filter(r=>filters.every(f=>f(r)))[0]||null):rows.filter(r=>filters.every(f=>f(r))).slice(offset,end+1),error:null}).then(resolve)}};return q}};const deliveries=[];async function notify(n){deliveries.push(n);tables.system_notifications.push({id:'notification',organization_id:org,event_key:'attendance_missing',entity_id:n.entityId,metadata:n.metadata,is_read:false});return {ok:true,notificationIds:['notification'],push:{sent:1,failed:0}}}return {client,notify,deliveries,tables}}
test('background runner does not send cancelled-session alerts and resolves an old warning',async()=>{const p=fixture(true);p.tables.system_notifications.push({id:'old',organization_id:'org',event_key:'attendance_missing',entity_id:'s',metadata:{lesson_date:'2026-10-14'},is_read:false});const r=await runAttendanceBackground(p.client,'org','2026-10-14',21*60+20,p.notify);assert.equal(r.created,0);assert.equal(r.resolved,1);assert.equal(p.deliveries.length,0)});
test('overdue real session requests push without a user session and sequential retry does not resend',async()=>{const p=fixture();const r=await runAttendanceBackground(p.client,'org','2026-10-14',21*60+20,p.notify);assert.equal(r.created,1);assert.equal(r.pushSent,1);assert.equal(p.deliveries[0].push,true);assert.equal((await runAttendanceBackground(p.client,'org','2026-10-14',21*60+25,p.notify)).created,0);assert.equal(p.deliveries.length,1)});

test('configured warning threshold is used by the real background runner',async()=>{const p=fixture();p.tables.organization_settings.push({organization_id:'org',section:'ders',config:{missing_alert_enabled:true,missing_alert_minutes:35},revision:1});assert.equal((await runAttendanceBackground(p.client,'org','2026-10-14',21*60+20,p.notify)).created,0);assert.equal((await runAttendanceBackground(p.client,'org','2026-10-14',21*60+36,p.notify)).created,1);assert.match(p.deliveries[0].body,/35 dakikadan/)});
test('disabling attendance warnings prevents new deliveries',async()=>{const p=fixture();p.tables.organization_settings.push({organization_id:'org',section:'ders',config:{missing_alert_enabled:false,missing_alert_minutes:15},revision:1});assert.equal((await runAttendanceBackground(p.client,'org','2026-10-14',23*60,p.notify)).created,0);assert.equal(p.deliveries.length,0)});

test('saving a completed session clears only that date and session for every recipient',async()=>{
 const {resolveAttendanceWarning}=load('lib/notifications/resolve-attendance-warning.ts');
 const p=fixture();
 const date='2026-10-14';
 const warning=(id,entity_id,lesson_date)=>({id,organization_id:'org',event_key:'attendance_missing',entity_id,metadata:{lesson_date},is_read:false});
 const warnings=[warning('a','s',date),warning('b','s',date),warning('c','other',date),warning('d','s','2026-10-07')];
 p.tables.system_notifications.push(...warnings);
 const schedule=p.tables.lesson_schedules[0];
 await resolveAttendanceWarning(p.client,'org',schedule,date);
 assert.deepEqual(warnings.map(row=>row.is_read),[false,false,false,false]);
 p.tables.attendance_records.push({organization_id:'org',student_id:'a',schedule_id:'s',group_id:'g',lesson_date:date});
 await resolveAttendanceWarning(p.client,'org',schedule,date);
 assert.deepEqual(warnings.map(row=>row.is_read),[true,true,false,false]);
 assert.ok(warnings[0].read_at);
});

test('approved freeze suppresses missing attendance and resumes on the return date',async()=>{
 const p=fixture();
 Object.assign(p.tables.student_enrollments[0],{
   freeze_start_date:'2026-10-14',freeze_resume_date:'2026-10-21',
 });
 assert.equal((await runAttendanceBackground(p.client,'org','2026-10-14',21*60+20,p.notify)).created,0);
 assert.equal((await runAttendanceBackground(p.client,'org','2026-10-21',21*60+20,p.notify)).created,1);
});

test('an approved manual freeze stays out of attendance past the planned date until restarted',async()=>{
 const p=fixture();
 const enrollment=p.tables.student_enrollments[0];
 Object.assign(enrollment,{
   freeze_start_date:'2026-10-14',freeze_resume_date:'2026-10-21',freeze_restart_pending:true,
 });
 assert.equal((await runAttendanceBackground(p.client,'org','2026-10-21',21*60+20,p.notify)).created,0);
 Object.assign(enrollment,{freeze_resume_date:'2026-10-28',freeze_restart_pending:false});
 assert.equal((await runAttendanceBackground(p.client,'org','2026-10-21',21*60+20,p.notify)).created,0);
 assert.equal((await runAttendanceBackground(p.client,'org','2026-10-28',21*60+20,p.notify)).created,1);
});

test('personnel reminders resolve profile-based assignments and skip checked-in or cancelled sessions', async () => {
  const { runPersonnelBackground } = load('lib/notifications/personnel-background.ts');
  const { client, tables } = fixture();
  Object.assign(tables.lesson_schedules[0], { coach_id: 'coach-profile', makeup_date: null });
  Object.assign(tables, {
    staff: [{
      id: 'staff-record', auth_user_id: 'coach-profile', first_name: 'Eğitmen', last_name: 'Test',
      organization_id: 'org', is_active: true, login_enabled: true,
    }],
    profiles: [{ id: 'coach-profile', role: 'coach', organization_id: 'org', is_active: true }],
    lesson_staff_assignments: [],
    lesson_session_exceptions: [],
    staff_checkins: [],
  });
  const date = '2026-10-14';
  const delivered = [];
  async function notify(n) {
    delivered.push(n);
    tables.system_notifications.push({ id: 'n1', organization_id: 'org', event_key: n.eventKey });
    return { ok: true, notificationIds: ['n1'], push: { sent: 1, failed: 0 } };
  }
  assert.equal((await runPersonnelBackground(client, 'org', date, 20 * 60 + 29, notify)).created, 0);
  tables.staff_checkins.push({ organization_id: 'org', lesson_date: date, schedule_id: 's', staff_id: 'staff-record' });
  assert.equal((await runPersonnelBackground(client, 'org', date, 20 * 60 + 30, notify)).created, 0);
  tables.staff_checkins.pop();
  tables.lesson_session_exceptions.push({ organization_id: 'org', lesson_date: date, schedule_id: 's', exception_type: 'pool_closed' });
  assert.equal((await runPersonnelBackground(client, 'org', date, 20 * 60 + 30, notify)).created, 0);
  tables.lesson_session_exceptions.pop();
  assert.equal((await runPersonnelBackground(client, 'org', date, 20 * 60 + 30, notify)).pushSent, 1);
  assert.equal((await runPersonnelBackground(client, 'org', date, 20 * 60 + 35, notify)).created, 0);
  assert.deepEqual(delivered.map((n) => n.recipientProfileIds), [['coach-profile']]);
  assert.equal(delivered[0].category, 'schedule');
  assert.equal(delivered[0].metadata.assignedProfileId, 'coach-profile');
  assert.equal(delivered[0].dedupeKey, 'staff_session_30m:2026-10-14:s:staff-record');
});
