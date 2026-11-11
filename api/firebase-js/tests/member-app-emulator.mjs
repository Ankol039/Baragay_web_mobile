import assert from 'node:assert/strict'
import { createContext } from '../core/context.mjs'
import { createStore } from '../core/store.mjs'
import { handleMemberApp } from '../member-app.mjs'
import { sha256 } from '../core/google.mjs'
const env = { BSS_USE_EMULATORS: 'true', FIREBASE_PROJECT_ID: 'barangay-survey-1cc7d', FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080' }
const store = createStore(env)
const operationId=crypto.randomUUID(), password='FixtureMember1234'
const person={courtesyTitle:'Mr.',firstName:'Fixture',middleName:'Member',lastName:'Emulator',nameExtension:'',gender:'man'}
const member={name:person,contact:{email:'fixture@example.invalid',number:'09123456789'},permanentAddress:{householdNumber:'1',purok:'',streetHighway:'',barangay:'Fixture',municipality:'Fixture',postalCode:'3000',province:'Fixture'},birthdate:'2000-01-01',birthplace:'Fixture',residencyStartDate:'2020-01-01',residencyStatus:'permanent',household:{occupation:'Fixture',hotlineNumber:'',isMarried:false,hasChildren:false},characterReferences:{'person-0':{person,displayOrder:0}}}
const counter=await store.get('counters/residentNumbers')
let uid, token
const call=async input=>{const req=new Request('http://localhost/api/firebase/member-app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});return handleMemberApp(createContext(req,env,input,JSON.stringify(input).length),input.action,input)}
try {
 await assert.rejects(()=>call({action:'profile'}),e=>e.status===401)
 const registration=await call({action:'register',operationId,member,password,confirm_password:password});uid=registration.data.uid
 assert.ok(registration.data.resident_number.startsWith('R-'))
 const login=await call({action:'login',identifier:registration.data.resident_number,password});token=login.data.idToken
 assert.equal(login.data.member.uid,uid);assert.equal(login.data.member.isFirstLogin,false)
 assert.match(login.data.realtime,/disabled/)
 assert.equal('password' in login.data.member,false)
 await assert.rejects(()=>call({action:'login',identifier:registration.data.resident_number,password:'Wrong1234'}),e=>e.status===401)
 const refreshed=await call({action:'refresh',refreshToken:login.data.refreshToken});assert.equal(refreshed.data.member.uid,uid);token=refreshed.data.idToken
 const edited=structuredClone(login.data.member);edited.contact.number='09999999999'
 const saved=await call({action:'save',idToken:token,member:edited});assert.equal(saved.data.member.contact.number,'09999999999')
 const proposal=structuredClone(saved.data.member);proposal.name.firstName='Corrected'
 const requested=await call({action:'save',idToken:token,member:proposal});assert.equal(requested.data.member.name.firstName,'Fixture');assert.match(requested.message,/review/)
 const marker=await store.get('pendingRequests/'+uid+'_nameAddress');assert.ok(marker.requestId)
 const request=await store.get('nameAddressRequests/'+marker.requestId);assert.equal(request.proposed.name.firstName,'Corrected')
 await call({action:'logout',idToken:token})
 console.log('PASS: emulator registration, Auth login/denial/refresh, Firestore profile, immediate contact edit, staff-review name request, disabled RTDB copy, and logout.')
} finally {
 if(uid){
  const paths=['users/'+uid,'residents/'+uid,'pendingRequests/'+uid+'_nameAddress','identifierAliases/residentNumber_'+await sha256((await store.get('users/'+uid)).identifier.toLowerCase())]
  for(const col of ['children','characterReferences'])for(const row of await store.list(`residents/${uid}/${col}`))paths.push(row.path)
  for(const col of ['nameAddressRequests','familyRequests','loginHistory'])for(const row of await store.list(col))if(row.data.ownerUid===uid||row.data.actorUid===uid)paths.push(row.path)
  paths.push('accountOperations/'+await sha256('public:'+operationId))
  const current=await store.get('counters/residentNumbers');const writes=paths.map(path=>store.remove(path))
  if(current?.lastUid===uid)writes.push(counter?store.write('counters/residentNumbers',counter):store.remove('counters/residentNumbers'))
  assert.equal((await store.commit(writes)).status,200)
  const context=createContext(new Request('http://localhost',{method:'POST'}),env)
  assert.equal((await context.authAdmin('accounts:delete',{localId:uid})).status,200)
 }
 console.log('Cleaned only synthetic member fixtures and restored the counter when unchanged by other activity.')
}
