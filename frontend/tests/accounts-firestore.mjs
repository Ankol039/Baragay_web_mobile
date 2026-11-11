import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { preserveAccounts } from './accounts-preserve.mjs'
import { emulatorEnv, root, project } from '../scripts/auth-dev.mjs'
Object.assign(process.env, emulatorEnv)
const { base, call, write, user } = await import('./firestore-fixtures.mjs')
const require = createRequire(new URL('../../migration/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const admin = initializeApp({projectId: project}, 'accounts-provisioning-test'), db = getFirestore(admin), adminAuth = getAuth(admin)
const preserve = await preserveAccounts(db, adminAuth, base, call)
const auth = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const port = 8787, endpoint = `http://127.0.0.1:${port}/api/firebase/accounts.php`
const tag = `accounts-${randomUUID()}`, actors = [tag+'-admin',tag+'-staff',tag+'-resident']
const operations = new Set(), newUsers = new Set(), docs = new Set(), originals = new Map()
let server, checks=0
const check=(v,m)=>{assert(v,m); checks++}
async function rest(url,body,method='POST') { const r=await call(url,'owner',body,method); assert(r.ok,JSON.stringify(r));return r.body }
async function get(path) { const r=await call(`${base}/${path}`,'owner'); return r.ok?r.body:null }
async function put(path,data,merge=false) {const w=write(path,data);if(merge)w.updateMask={fieldPaths:Object.keys(data)};await rest(`${base}:commit`,{writes:[w]})}
async function api(action,values={},idToken) {const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values,...(idToken?{idToken}:{})})});return {status:r.status,...await r.json()}}
async function sign(email,password) {const r=await call(`${auth}/accounts:signInWithPassword?key=emulator-only`,null,{email,password,returnSecureToken:true});return r.body}
const values={first_name:'Registration',middle_name:'Synthetic',last_name:'Resident',birthdate:'2000-01-01',gender:'woman',birthplace:'Test town',
 residency_status:'permanent',residency_start_date:'2020-01-01',household_number:'11',barangay:'Test Barangay',municipality:'Test City',province:'Test Province',postal_code:'1234',
 references:[{first_name:'Reference',last_name:'Person',gender:'man'}],password:'FixturePass8',confirm_password:'FixturePass8'}
async function register(v=values,token,action='registerResident',operationId=randomUUID()) {operations.add(createHash('sha256').update((token?actors[0]:'public')+':'+operationId).digest('hex'));const r=await api(action,{values:v,operationId},token);if(r.data?.uid)newUsers.add(r.data.uid);return {...r,operationId}}
try {
 check((await fetch('http://127.0.0.1:4400/emulators')).ok,'Existing emulators available')
 for(const name of ['residentNumbers','staffNumbers']) originals.set('counters/'+name,await get('counters/'+name))
 const tokens=[]
 for(const [i,uid] of actors.entries()) {
  await rest(`${auth}/projects/${project}/accounts`,{localId:uid,email:`${uid}@example.invalid`,password:'FixturePass8'})
  await put('users/'+uid,user(uid,['admin','staff','resident'][i]));docs.add('users/'+uid)
  tokens.push((await sign(`${uid}@example.invalid`,'FixturePass8')).idToken)
 }
 server=spawn('php',['-S',`127.0.0.1:${port}`,'-t',root],{cwd:root,env:emulatorEnv,stdio:'ignore'})
 for(let i=0;i<70;i++){try {if((await api('registrationFields')).ok)break}catch{} await new Promise(r=>setTimeout(r,100))}
 const fields=await api('registrationFields');check(fields.ok&&fields.data.fields.genders.woman,'Public original registration metadata')
 check((await register({...values,first_name:''})).message==='Please fill in all required fields (marked with *).','Original required validation')
 check((await register({...values,references:[]})).message==='At least one character reference is required.','Original references required')
 check((await register({...values,password:'weak',confirm_password:'weak'})).ok===false,'Password policy enforced')
 check((await api('createStaff',{operationId:randomUUID(),values:{}},tokens[1])).status===403,'Staff cannot provision staff')
 check((await api('createResident',{operationId:randomUUID(),values},tokens[2])).status===403,'Resident cannot staff-provision')
 const created=await register();check(created.ok,'Public resident provisioned: '+created.message)
 const uid=created.data.uid,number=created.data.resident_number
 const u=(await get('users/'+uid)).fields
 check(u.role.stringValue==='resident'&&!u.isFirstLogin.booleanValue&&u.selfRegistered.booleanValue&&u.isActive.booleanValue,'Public role/setup/activity metadata correct')
 check((await sign(number.toLowerCase()+'@barangay.app','FixturePass8')).localId===uid,'Chosen Auth password actually works')
 const resolver=await fetch(`http://127.0.0.1:${port}/api/firebase/index.php?action=resolve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:number,password:'FixturePass8'})})
 check((await resolver.json()).ok,'Issued Resident Number resolves')
 const replay=await register(values,undefined,'registerResident',created.operationId);check(replay.data?.uid===uid,'Identical public retry idempotent')
 check((await register({...values,password:'DifferentPass8',confirm_password:'DifferentPass8'},undefined,'registerResident',created.operationId)).status===403,'Operation ID alone cannot recover account')
 const [c1,c2]=await Promise.all([register(),register()]);check(c1.ok&&c2.ok&&c1.data.resident_number!==c2.data.resident_number,'Concurrent allocations unique')
 // Recreate an interrupted final activation and safely resume the same operation.
 const opPath='accountOperations/'+createHash('sha256').update('public:'+created.operationId).digest('hex')
 await put(opPath,{state:'profileReady'},true);await put('users/'+uid,{isActive:false},true)
 await rest(`${auth}/projects/${project}/accounts:update`,{localId:uid,disableUser:true})
 check((await register(values,undefined,'registerResident',created.operationId)).ok,'Interrupted provision resumes')
 check((await sign(number.toLowerCase()+'@barangay.app','FixturePass8')).localId===uid,'Recovered provision logs in')
 const resetOperation=randomUUID();operations.add(createHash('sha256').update(actors[0]+':'+resetOperation).digest('hex'))
 check((await api('resetResident',{operationId:resetOperation,targetUid:uid},tokens[0])).ok,'Trusted reset succeeds')
 check((await sign(number.toLowerCase()+'@barangay.app',number)).localId===uid,'Reset actually changes Auth password')
 check(!(await sign(number.toLowerCase()+'@barangay.app','FixturePass8')).idToken,'Previous password no longer works')
 check((await get('users/'+uid)).fields.isFirstLogin.booleanValue,'Reset sets first-login')
 await rest(`${auth}/projects/${project}/accounts:update`,{localId:uid,password:'WorkingPass9'})
 check((await api('resetResident',{operationId:resetOperation,targetUid:uid},tokens[0])).ok,'Reset result replays')
 check((await sign(number.toLowerCase()+'@barangay.app','WorkingPass9')).localId===uid,'Completed reset retry does not overwrite subsequent password')
 const staffValues={first_name:'Created',last_name:'Staff',date_hired:'2020-01-01'}
 const staff=await register(staffValues,tokens[0],'createStaff');check(staff.ok,'Admin staff provisioning succeeds: '+staff.message)
 const staffNumber=staff.data.new_staff.staff_number
 check((await sign(staffNumber.toLowerCase()+'@barangay.app',staffNumber)).localId===staff.data.uid,'Issued staff credential works')
 check((await get('users/'+staff.data.uid)).fields.profileCompleted.booleanValue===false,'Staff onboarding retained')
 check((await api('resetStaff',{operationId:randomUUID(),targetUid:actors[0]},tokens[0])).message==='Use Change Password to update your own password.','Self reset refused')
 check((await sign(`${actors[0]}@example.invalid`,'FixturePass8')).idToken,'Provisioning preserves admin session credentials')
 console.log(`Accounts provisioning emulator checks: ${checks} passed`)
} catch(error) { console.error(error); throw error } finally {
 server?.kill()
 await preserve.restore()
 await db.terminate(); await deleteApp(admin)
}
