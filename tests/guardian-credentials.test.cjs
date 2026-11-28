const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,imports={}){const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};new Function('require','exports','module',js)(name=>{if(name in imports)return imports[name];if(name==='@/lib/guardian/portal-student-eligibility')return load('lib/guardian/portal-student-eligibility.ts');if(name==='@/lib/guardian/portal-recipient')return load('lib/guardian/portal-recipient.ts');if(name==='next/navigation')return {};if(name==='@/lib/supabase/server')return {};if(name==='@/lib/guardian/setup-token')return load('lib/guardian/setup-token.ts',{'node:crypto':require('node:crypto')});throw Error('Unexpected import '+name);},m.exports,m);return m.exports;}
function harness({active=true,org='org',portal=true,updateError=false,studentStatus='active',frozen=false,activeSibling=false}={}) {
 const writes=[];
 const tables={profiles:[{id:'account',organization_id:org,role:'guardian',full_name:'Test Veli',phone:'+905550000000',email:'',is_active:active}],guardians:[{id:'person',organization_id:org,auth_user_id:'account',is_active:true,login_enabled:portal}],students:[{id:'child',organization_id:org,status:studentStatus,is_deleted:false},...(activeSibling?[{id:'sibling',organization_id:org,status:'active',is_deleted:false}]:[])],student_enrollments:frozen?[{student_id:'child',organization_id:org,status:'active',freeze_restart_pending:true,freeze_start_date:'2020-01-01'}]:[],guardian_students:[{guardian_id:'person',student_id:'child',portal_access:true,is_primary:true},...(activeSibling?[{guardian_id:'person',student_id:'sibling',portal_access:true}]:[])]};
 const client={from(table){let rows=[...(tables[table]||[])];const q={select(){return q;},eq(k,v){rows=rows.filter(r=>r[k]===v);return q;},lte(k,v){rows=rows.filter(r=>r[k]<=v);return q;},in(k,vs){rows=rows.filter(r=>vs.includes(r[k]));return q;},order(){return q;},maybeSingle(){return Promise.resolve({data:rows[0]||null,error:null});},then(ok,no){return Promise.resolve({data:rows,error:null}).then(ok,no);}};return q;},auth:{admin:{getUserById:async id=>({data:{user:id==='account'?{id,created_at:'created',updated_at:'old'}:null},error:null}),updateUserById:async(id,input)=>{writes.push({id,input});return {data:{user:{id,created_at:'created',updated_at:'new'}},error:updateError?{message:'test'}:null};}}}};
 const actions=load('app/veliler/portal-credential-actions.ts',{'@supabase/supabase-js':{createClient:()=>client},'@/lib/auth/profile':{requireProfile:async()=>({id:'admin',organization_id:'org'})},'@/lib/guardian/revalidate':{revalidateGuardianConnection(){}}});
 return {actions,writes};
}
test('Opening share by account or student does not reset the password',async()=>{const {actions,writes}=harness();assert.equal((await actions.portalCredentialContact({accountId:'account'})).ok,true);assert.equal((await actions.portalCredentialContact({studentId:'child'})).accountId,'account');assert.equal(writes.length,0);});
test('The chosen password is saved exactly once and returned unchanged for the message',async()=>{const {actions,writes}=harness();const result=await actions.savePortalCredential({studentId:'child'},'Chosen-Test-94!');assert.equal(result.ok,true);assert.equal(result.password,'Chosen-Test-94!');assert.equal(result.revision,'new');assert.deepEqual(writes,[{id:'account',input:{password:'Chosen-Test-94!'}}]);});
test('Inactive, disabled, unrelated and foreign organization accounts cannot be changed',async()=>{for(const options of [{active:false},{portal:false},{org:'other'}]){const {actions,writes}=harness(options);assert.equal((await actions.savePortalCredential({accountId:'account'},'Chosen-Test-94!')).ok,false);assert.equal(writes.length,0);}const {actions,writes}=harness();assert.equal((await actions.savePortalCredential({studentId:'stranger'},'Chosen-Test-94!')).ok,false);assert.equal(writes.length,0);});
test('Invalid password is rejected without writing; authentication failure returns no credential',async()=>{const {actions,writes}=harness();for(const p of ['short',' leading-space','new\npassword','back`tick','a'.repeat(101)])assert.equal((await actions.savePortalCredential({accountId:'account'},p)).ok,false);assert.equal(writes.length,0);const failed=await harness({updateError:true}).actions.savePortalCredential({accountId:'account'},'Chosen-Test-94!');assert.equal(failed.ok,false);assert.equal(failed.password,undefined);});
test('The WhatsApp message contains the setup link and omits the password',()=>{const {portalMessage}=load('lib/guardian/portal-message.ts');const msg=portalMessage({fullName:'Test',phone:'+905550000000',password:'Chosen-Test-94!',setupPath:'/s#Abcdefghijklmnopqrstuv'},'https://example.test');assert.match(msg,/https:\/\/example.test\/s#Abcdefghijklmnopqrstuv/);assert.doesNotMatch(msg,/Chosen-Test-94!|undefined/);});
test('Saved credentials are reused across screens by account, and invalidated after another password change',()=>{
 const listeners=[];global.window={dispatchEvent:event=>listeners.push(event)};global.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
 const drafts=load('lib/guardian/credential-draft.ts');const value={accountId:'same-parent',revision:'first',password:'Chosen-Test-94!',phone:'+905550000000',fullName:'Veli'};
 drafts.rememberPortalCredential(value);assert.equal(drafts.portalCredentialDraft('same-parent','first').password,value.password);assert.equal(drafts.portalCredentialDraft('other-parent','first'),null);assert.equal(drafts.portalCredentialDraft('same-parent','second'),null);assert.equal(drafts.portalCredentialDraft('same-parent','first'),null);assert.equal(listeners.length,1);
});
test('Preparing existing linked accounts preserves passwords and resolves the linked identity',async()=>{
 let changes=0;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
 const rows={students:[{id:'child',status:'active',first_name:'Child',last_name:'Test',guardian_name:'Outdated Name',guardian_phone:'05551111111'}],guardian_students:[{student_id:'child',guardian_id:'person',portal_access:true}],guardians:[{id:'person',auth_user_id:'actual-linked-parent'}]};
 const client={from(table){let values=[...(rows[table]||[])];const q={select(){return q;},eq(k,v){if(k==='organization_id'||k==='is_deleted')return q;values=values.filter(r=>r[k]===v);return q;},lte(k,v){values=values.filter(r=>r[k]<=v);return q;},in(k,vs){values=values.filter(r=>vs.includes(r[k]));return q;},then(ok,no){return Promise.resolve({data:values,error:null}).then(ok,no);}};return q;}};
 const contact={ok:true,accountId:'actual-linked-parent',revision:'unchanged',fullName:'Actual Parent',phone:'+905552222222',email:''};
 const bulk=load('app/veliler/ogrenciden-olustur/bulk-account-actions.ts',{'@supabase/supabase-js':{createClient:()=>client},'next/cache':{revalidatePath(){}},'@/lib/auth/profile':{requireProfile:async()=>({organization_id:'org'})},'../portal-credential-actions':{portalCredentialContact:async()=>contact,savePortalCredential:async()=>{changes++;return {...contact,password:'Reset-Test-94!',message:'Saved'};}}});
 const batch=await bulk.prepareGuardianAccountBatch(['child','inactive']);assert.equal(batch.find(item=>item.key==='inactive').ok,false);const result=batch.find(item=>item.ok);assert.equal(changes,0);assert.equal(result.accountId,'actual-linked-parent');assert.equal(result.phone,contact.phone);assert.equal(result.password,undefined);assert.equal(result.status,'linked');
 const [reset]=await bulk.prepareGuardianAccountBatch(['child'],true);assert.equal(changes,1);assert.equal(reset.password,'Reset-Test-94!');
});

test('Password setup links reject tampering and expire after one hour', (t) => {
 const {sealSetupToken,openSetupToken}=load('lib/guardian/setup-token.ts',{'node:crypto':require('node:crypto')});
 const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-role-key';
 t.after(()=>{if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;});
 const now=t.mock.method(Date,'now',()=>100);
 const token=sealSetupToken('provider-recovery-token');
 assert.equal(openSetupToken(token),'provider-recovery-token');
 assert.equal(openSetupToken((token[0]==='a'?'b':'a')+token.slice(1)),null);
 now.mock.mockImplementation(()=>100+60*60*1000);
 assert.equal(openSetupToken(token),null);
});

test('Short links use a URL-safe 128-bit code and a distinct database lookup hash', () => {
 const {newShortSetupCode,shortSetupCodePattern,hashShortSetupCode}=load('lib/guardian/setup-token.ts',{'node:crypto':require('node:crypto')});
 const code=newShortSetupCode();
 assert.match(code,shortSetupCodePattern);
 assert.equal(Buffer.from(code,'base64url').length,16);
 assert.match(hashShortSetupCode(code),/^[a-f0-9]{64}$/);
 assert.notEqual(hashShortSetupCode(code),hashShortSetupCode(code+'a'));
});

test('Inactive or frozen students cannot receive setup links, including through an old selection', async () => {
 for (const options of [{studentStatus:'passive'},{frozen:true}]) {
  const {actions,writes}=harness(options);
  assert.equal((await actions.createPortalSetupLink({accountId:'account'})).ok,false);
  assert.equal((await actions.createPortalSetupLink({studentId:'child'})).ok,false);
  assert.equal(writes.length,0);
 }
 const {actions}=harness({studentStatus:'passive',activeSibling:true});
 assert.equal((await actions.portalCredentialContact({accountId:'account'})).ok,true);
 assert.equal((await actions.portalCredentialContact({accountId:'account',studentId:'child'})).ok,false);
});
