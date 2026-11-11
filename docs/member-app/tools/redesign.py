"""Rebuild the handoff AIA with native App Inventor components and a trusted API bridge."""
import copy,json,itertools,sys,zipfile
from pathlib import Path
import xml.etree.ElementTree as E
NS='http://www.w3.org/1999/xhtml'; E.register_namespace('',NS);q=lambda s:'{'+NS+'}'+s
root=Path(sys.argv[1]); dest=Path(sys.argv[2]); folder=root/'src/appinventor/ai_student/activity7'
count=itertools.count(20000)
def B(typ,fields=None,values=None,mut=None,statements=None):
 b=E.Element(q('block'),{'type':typ,'id':'BSS_'+str(next(count))})
 if mut is not None:E.SubElement(b,q('mutation'),mut)
 for k,v in (fields or {}).items():E.SubElement(b,q('field'),{'name':k}).text=str(v)
 for k,v in (values or {}).items():E.SubElement(b,q('value'),{'name':k}).append(v)
 for k,v in (statements or {}).items():
  if v is not None:E.SubElement(b,q('statement'),{'name':k}).append(v)
 return b
def T(s):return B('text',{'TEXT':s})
def N(n):return B('math_number',{'NUM':n})
def BOOL(v):return B('logic_boolean',{'BOOL':'TRUE' if v else 'FALSE'})
def GET(n):
 return B('lexical_variable_get',{'VAR':n},mut={}) if n in ['responseCode','responseContent','value','message'] else B('lexical_variable_get',{'VAR':n})
def SET(n,v):return B('lexical_variable_set',{'VAR':n},{'VALUE':v})
def chain(*blocks):
 blocks=[copy.deepcopy(b) for b in blocks if b is not None]
 for a,b in zip(blocks,blocks[1:]):
  tail=a
  while tail.find(q('next')) is not None:tail=tail.find(q('next')).find(q('block'))
  E.SubElement(tail,q('next')).append(b)
 return blocks[0] if blocks else None
def method(name,typ,fn,*args):return B('component_method',{'COMPONENT_SELECTOR':name},{'ARG'+str(i):a for i,a in enumerate(args)}, {'component_type':typ,'method_name':fn,'is_generic':'false','instance_name':name})
def prop(name,typ,p='Text',value=None):return B('component_set_get',{'COMPONENT_SELECTOR':name,'PROP':p}, {'VALUE':value} if value is not None else None,{'component_type':typ,'set_or_get':'set' if value is not None else 'get','property_name':p,'is_generic':'false','instance_name':name})
def event(name,typ,ev,body):return B('component_event',{'COMPONENT_SELECTOR':name},mut={'component_type':typ,'is_generic':'false','instance_name':name,'event_name':ev},statements={'DO':body})
def lookup(obj,key,default=None):return B('dictionaries_lookup',values={'KEY':T(key),'DICT':obj,'NOTFOUND':default if default is not None else T('')})
def pair(k,v):return B('pair',values={'KEY':T(k),'VALUE':v})
def dic(**values):return B('dictionaries_create_with',values={'ADD'+str(i):pair(k,v) for i,(k,v) in enumerate(values.items())},mut={'items':str(len(values))})
def put(obj,k,v):return B('dictionaries_set_pair',values={'DICT':obj,'KEY':T(k),'VALUE':v})
def eq(a,b):return B('logic_compare',{'OP':'EQ'},{'A':a,'B':b})
def choose(test,yes,no):return B('controls_choose',values={'TEST':test,'THENRETURN':yes,'ELSERETURN':no})
def iff(test,yes,no=None):return B('controls_if',values={'IF0':test},mut={'elseif':'0','else':'1' if no is not None else '0'},statements={'DO0':yes,'ELSE':no})
def join(*vals):return B('text_join',values={'ADD'+str(i):v for i,v in enumerate(vals)},mut={'items':str(len(vals))})
def call(name,*args):
 b=B('procedures_callnoreturn',values={'ARG'+str(i):a for i,a in enumerate(args)},mut={'name':name})
 for i in range(len(args)):E.SubElement(b.find(q('mutation')),q('arg'),{'name':['action','payload'][i] if name=='apiSend' else ['title','message'][i]})
 return b
def dbget(k):return method('dbSession','TinyDB','GetValue',T(k),T(''))
def store(k,v):return method('dbSession','TinyDB','StoreValue',T(k),v)
def notice(msg):return method('ntfApi','Notifier','ShowMessageDialog',msg,T('Barangay Health Center'),T('OK'))
def send(action,payload=None):return call('apiSend',T(action),payload if payload is not None else dic())
def component(name,typ,**props):return {'$Name':name,'$Type':typ,'$Version':{'Web':'8','TinyDB':'2','Notifier':'6','Label':'5','PasswordTextBox':'8','Button':'7','VerticalArrangement':'4','WebViewer':'11'}.get(typ,'1'),'Uuid':str(next(count)),**props}
def textfield(c):return B('text_trim',values={'TEXT':prop(c,'TextBox')})
def find_event(r,name,ev):
 return next((b for b in r if b.get('type')=='component_event' and b.find(q('mutation')).get('instance_name')==name and b.find(q('mutation')).get('event_name')==ev),None)
def statement(b):return b.find(q('statement')).find(q('block'))
def replace_body(b,new):
 st=b.find(q('statement'));st.clear();st.set('name','DO');st.append(new)
def nodes(c):
 yield c
 for child in c.get('$Components',[]):yield from nodes(child)
def find(c,name):return next(x for x in nodes(c) if x['$Name']==name)
colors={'&HFF101828':'&HFF223028','&HFF475467':'&HFF6B7C76','&HFFF2F4F7':'&HFFF4F7F6','&HFFFFD23F':'&HFF1D6F5E','&HFFD0D5DD':'&HFFDBE5E1','&HFFB42318':'&HFFC0392B'}
screens=['Screen1','Register','Home','Profile','EditProfile','Membership','FirebaseConnection']
for screen in screens:
 p=folder/(screen+'.scm');doc=json.loads(p.read_text().split('$JSON\n')[1].split('\n|#')[0]);form=doc['Properties']
 r=E.parse(folder/(screen+'.bky')).getroot()
 old_init=find_event(r,screen,'Initialize')
 old_body=copy.deepcopy(statement(old_init)) if old_init is not None else None
 for c in nodes(form):
  for key,value in list(c.items()):
   if isinstance(value,str) and value in colors:c[key]=colors[value]
  if c['$Type']=='Form':c.update(BackgroundColor='&HFFF4F7F6',PrimaryColor='&HFF1D6F5E',PrimaryColorDark='&HFF14483D',AccentColor='&HFF1D6F5E',TitleVisible='False',AppName='Barangay Health Center',VersionName='2.0')
  if c['$Type']=='Button' and c.get('BackgroundColor')=='&HFF223028':c.update(BackgroundColor='&HFF1D6F5E',TextColor='&HFFFFFFFF',Shape='1',FontSize='15',FontBold='True',Height='50')
  if c['$Type']=='HorizontalArrangement' and c.get('BackgroundColor')=='&HFF1D6F5E':
   c['Height']='64'
   for x in nodes(c):
    if x['$Type']=='Label':x.update(TextColor='&HFFFFFFFF',FontBold='True',FontSize='20')
  if c['$Type']=='TinyDB':c['Namespace']='BarangayMember'
  if c['$Type'] in ['TextBox','PasswordTextBox']:c.update(FontSize='16',Height='48',TextColor='&HFF223028')
  if c['$Type']=='Label' and (c['$Name'].startswith('hdr') or c['$Name'] in ['lblTitle','lblName']):c.update(TextColor='&HFF14483D',FontBold='True')
  if c['$Type']=='Label' and c.get('Text') in ['Name','Permanent address','Household','Contact details','Security','Residency','Personal details']:c.update(FontSize='19')
 # Rebuild identity sections as the same green hero used by the resident portal.
 if screen in ['Home','Profile','Membership','FirebaseConnection']:
  hero={'Home':'ver8','Profile':'ver6','Membership':'ver8','FirebaseConnection':'verDbCard'}[screen]
  card=find(form,hero);card['BackgroundColor']='&HFF14483D'
  for x in nodes(card):
   if x['$Type']=='Label':x['TextColor']='&HFFFFFFFF'
   if x['$Name']=='lblStatus':x.update(BackgroundColor='&HFFE8F3EF',TextColor='&HFF14483D')
 if screen=='Register':
  form['$Components'][0]['BackgroundColor']='&HFF14483D'
  for x in nodes(form['$Components'][0]):
   if x['$Type']=='Label':x['TextColor']='&HFFFFFFFF'
 # Old FirebaseDB component is removed: no open-database or plaintext-password path remains.
 form['$Components']=[c for c in form['$Components'] if c['$Type']!='FirebaseDB']
 form['$Components'] += [component('webApi','Web',Timeout='30000'),component('dbSession','TinyDB',Namespace='BarangayMember'),component('ntfApi','Notifier')]
 if screen=='Screen1':
  find(form,'lblTitle')['Text']='Barangay Health Center';find(form,'lblTag')['Text']='Resident portal';find(form,'lab21')['Text']='Your barangay. Your health. Your community.'
  find(form,'imgLogo').update(Width='112',Height='112')
 # Replace photo Images with native WebViewers that can display compressed data URLs.
 for c in nodes(form):
  if c['$Name']=='imgPhoto':
   c.clear();c.update(component('imgPhoto','WebViewer',HomeUrl='http://localhost/member-photo.html',Width='96',Height='96',FollowLinks='False',UsesLocation='False'))
 for b in r.iter(q('block')):
  m=b.find(q('mutation'))
  if m is not None and m.get('instance_name')=='imgPhoto' and m.get('property_name')=='Picture':
   m.set('component_type','WebViewer');m.set('property_name','WebViewString')
   for f in b.findall(q('field')):
    if f.get('name')=='PROP':f.text='WebViewString'
 # Network state and shared procedure. No credentials embedded in the AIA.
 r.append(B('global_declaration',{'NAME':'apiAction'},{'VALUE':T('')}))
 r.append(B('global_declaration',{'NAME':'apiResponse'},{'VALUE':dic()}))
 r.append(B('global_declaration',{'NAME':'apiBusy'},{'VALUE':BOOL(False)}))
 payload=GET('payload')
 proc=B('procedures_defnoreturn',{'NAME':'apiSend'},mut={})
 for arg in ['action','payload']:E.SubElement(proc.find(q('mutation')),q('arg'),{'name':arg})
 E.SubElement(proc,q('statement'),{'name':'STACK'}).append(iff(eq(GET('global apiBusy'),BOOL(False)),chain(
 SET('global apiBusy',BOOL(True)),SET('global apiAction',GET('action')),
 put(GET('payload'),'action',GET('action')),put(GET('payload'),'idToken',dbget('idToken')),
 prop('webApi','Web','Url',T('https://barangay-survey-api.barangay-survey-api.workers.dev/api/firebase/member-app')),
 prop('webApi','Web','RequestHeaders',B('lists_create_with',values={'ADD0':B('lists_create_with',values={'ADD0':T('Content-Type'),'ADD1':T('application/json')},mut={'items':'2'})},mut={'items':'1'})),
 method('webApi','Web','PostText',method('webApi','Web','JsonObjectEncode',GET('payload'))))))
 r.append(proc)
 response=lambda:GET('global apiResponse')
 data=lambda:lookup(response(),'data',dic())
 restore=[];success=[]
 if screen=='Screen1':
  for b in list(r):
   if b.get('type')=='component_event' and b.find(q('mutation')).get('instance_name') in ['fbLogin',screen]:r.remove(b)
  b=find_event(r,'btnLogin','Click'); cond=statement(b);els=next(x for x in cond.findall(q('statement')) if x.get('name')=='ELSE');els.clear();els.set('name','ELSE');els.append(chain(prop('btnLogin','Button','Enabled',BOOL(False)),prop('btnLogin','Button','Text',T('Signing in...')),send('login',dic(identifier=textfield('txtLoginEmail'),password=prop('txtLoginPassword','PasswordTextBox')))))
  restore=[prop('btnLogin','Button','Enabled',BOOL(True)),prop('btnLogin','Button','Text',T('Log in'))]
  success=[prop('txtLoginPassword','PasswordTextBox','Text',T('')),call('showSuccess',T('Login Successful!'),T('Welcome to your resident portal.'))]
 elif screen=='Register':
  register_member=copy.deepcopy(next(b for b in r.iter(q('block')) if b.get('id')=='Register_650'))
  pairs=[]
  for v in register_member.findall(q('value')):
   block=v.find(q('block'));key=block.find(q('value')).find(q('block')).find(q('field')).text
   if key not in ['password']:pairs.append(block)
  for v in register_member.findall(q('value')):register_member.remove(v)
  for i,block in enumerate(pairs):E.SubElement(register_member,q('value'),{'name':'ADD'+str(i)}).append(block)
  register_member.find(q('mutation')).set('items',str(len(pairs)))
  for b in list(r):
   if b.get('type')=='component_event' and b.find(q('mutation')).get('instance_name')=='fbRegister':r.remove(b)
  click=find_event(r,'btnRegister','Click');cond=statement(click);els=next(x for x in cond.findall(q('statement')) if x.get('name')=='ELSE');els.clear();els.set('name','ELSE')
  operation=join(T('00000000-0000-4000-8000-'),method('clkRegister','Clock','SystemTime'))
  # Last 12 decimal timestamp digits are valid hexadecimal UUID characters.
  operation=join(T('00000000-0000-4000-8000-'),B('text_segment',values={'TEXT':join(T('000000000000'),method('clkRegister','Clock','SystemTime')),'START':B('math_subtract',values={'A':B('text_length',values={'VALUE':join(T('000000000000'),method('clkRegister','Clock','SystemTime'))}),'B':N(11)}),'LENGTH':N(12)}))
  r.append(B('global_declaration',{'NAME':'registrationOperation'},{'VALUE':T('')}))
  els.append(chain(iff(eq(GET('global registrationOperation'),T('')),SET('global registrationOperation',operation)),prop('btnRegister','Button','Enabled',BOOL(False)),prop('btnRegister','Button','Text',T('Creating account...')),send('register',dic(member=register_member,password=prop('txtRegPassword','PasswordTextBox'),confirm_password=prop('txtRegConfirm','PasswordTextBox'),operationId=GET('global registrationOperation')))))
  restore=[prop('btnRegister','Button','Enabled',BOOL(True)),prop('btnRegister','Button','Text',T('Create account'))]
  success=[prop('txtRegPassword','PasswordTextBox','Text',T('')),prop('txtRegConfirm','PasswordTextBox','Text',T('')),SET('global registrationOperation',T('')),call('showSuccess',T('Registration Successful!'),join(T('Your Resident Number is '),lookup(data(),'resident_number'),T('. Use it to log in.')))]
 elif screen=='FirebaseConnection':
  r=E.Element(q('xml'),{}) if False else r
  for b in list(r):
   if b.get('type') in ['component_event','procedures_defnoreturn'] and (b.get('type')!='procedures_defnoreturn' or b.find(q('field')).text!='apiSend'):r.remove(b)
  def check():return chain(prop('lblDbState','Label','Text',T('Checking')),prop('lblDbUrl','Label','Text',T('barangay-survey-1cc7d')),prop('lblDbBucket','Label','Text',T('Members / your Firebase UID')),send('connection'))
  r.extend([event(screen,'Form','Initialize',check()),event('btnDbRefresh','Button','Click',check()),event('btnDbBack','Button','Click',B('controls_closeScreen'))])
  success=[prop('lblDbState','Label','Text',T('Connected')),prop('lblDbLatency','Label','Text',T('Live authenticated response')),prop('lblDbCount','Label','Text',T('Your member record')),prop('lblDbTree','Label','Text',join(T('Firebase Authentication: signed in\nFirestore: connected\nResident Number: '),lookup(lookup(data(),'member',dic()),'identifier'),T('\nRealtime Database: '),lookup(data(),'realtime')))]
 else:
  if screen=='EditProfile':
   # Read form into a proposal; server determines which changes need staff approval.
   click=find_event(r,'btnEditSave','Click');cond=statement(click);els=next(x for x in cond.findall(q('statement')) if x.get('name')=='ELSE')
   old=copy.deepcopy(els.find(q('block')));blocks=[];current=old
   while current is not None:
    nxt=current.find(q('next'));following=nxt.find(q('block')) if nxt is not None else None
    if nxt is not None:current.remove(nxt)
    if current.get('type')=='dictionaries_set_pair':
     key=current.find(q('value')).find(q('block')).find(q('field')).text
     if key!='photoDataUrl':blocks.append(current)
    current=following
   els.clear();els.set('name','ELSE');els.append(chain(*blocks,send('save',dic(member=GET('global member')))))
   for b in list(r):
    if b.get('type')=='component_event' and b.find(q('mutation')).get('instance_name') in ['fbEdit','pickPhoto']:r.remove(b)
   picker=find(form,'pickPhoto');picker.clear();picker.update(component('pickPhoto','WebViewer',HomeUrl='http://localhost/member-photo-upload.html',Height='64',Width='220',UsesLocation='False'))
   r.append(event('pickPhoto','WebViewer','WebViewStringChange',send('photo',dic(photo=GET('value')))))
   find(form,'hnt200')['Text']='Name, address and household edits go to barangay staff for review. Save those requests separately. Contact changes save immediately. Save your edits before choosing a photo.'
   success=[notice(lookup(response(),'message',T('Profile loaded.')))]
  # Cached screen render, then refresh the Auth session and read authoritative Firestore data.
  if screen=='Home':
   render=call('render')
   success=[render]
   form['$Components'].append(component('verPassword','VerticalArrangement',Width='-1092',Visible='False',BackgroundColor='&HFFE8F3EF',**{'$Components':[
    component('lblPasswordInfo','Label',Text='Set your new password before using your account.',Width='-2',TextColor='&HFF14483D',FontSize='16'),
    component('txtCurrentPassword','PasswordTextBox',Hint='Current password',Width='-2',Height='48'),component('txtNewPassword','PasswordTextBox',Hint='New password',Width='-2',Height='48'),component('txtConfirmPassword','PasswordTextBox',Hint='Confirm new password',Width='-2',Height='48'),component('btnPassword','Button',Text='Change password',Width='-2',Height='50',BackgroundColor='&HFF1D6F5E',TextColor='&HFFFFFFFF')]}))
   success.append(prop('verPassword','VerticalArrangement','Visible',lookup(lookup(data(),'member',dic()),'isFirstLogin',BOOL(False))))
   r.append(event('btnPassword','Button','Click',send('password',dic(current_password=prop('txtCurrentPassword','PasswordTextBox'),new_password=prop('txtNewPassword','PasswordTextBox'),confirm_password=prop('txtConfirmPassword','PasswordTextBox')))))
   # Enforce first-login password at the server; the existing pages stay unchanged in count.
   success=[iff(eq(GET('global apiAction'),T('password')),chain(method('dbSession','TinyDB','ClearAll'),notice(lookup(response(),'message')),B('controls_closeScreen')),chain(*success))]
   for b in [find_event(r,screen,'Initialize'),find_event(r,screen,'OtherScreenClosed')]:
    if b is not None:replace_body(b,chain(call('render'),send('refresh',dic(refreshToken=dbget('refreshToken')))))
  else:
   if old_init is not None:
    replace_body(old_init,chain(old_body,send('refresh',dic(refreshToken=dbget('refreshToken')))))
    success=[copy.deepcopy(old_body)]+success
  # Logout clears cached tokens and profiles. Remote audit is attempted separately.
  for name in ['btnHomeLogout','btnProfLogout']:
   b=find_event(r,name,'Click')
   if b is not None:replace_body(b,chain(method('dbSession','TinyDB','ClearAll'),B('controls_closeScreen')))
 # Shared response: reset network flag, cache member and refreshed tokens, then update screen.
 common=[iff(B('logic_negate',values={'BOOL':eq(lookup(data(),'member'),T(''))}),store('member',lookup(data(),'member')))]
 for key in ['idToken','refreshToken']:
  common.append(iff(B('logic_negate',values={'BOOL':eq(lookup(data(),key),T(''))}),store(key,lookup(data(),key))))
 good=B('logic_operation',{'OP':'AND'},{'A':B('math_compare',{'OP':'EQ'},{'A':GET('responseCode'),'B':N(200)}),'B':eq(lookup(response(),'ok',BOOL(False)),BOOL(True))})
 failure=notice(lookup(response(),'message',T('The request could not be completed. Please try again.')))
 r.append(event('webApi','Web','GotText',chain(SET('global apiBusy',BOOL(False)),*restore,SET('global apiResponse',method('webApi','Web','JsonTextDecodeWithDictionaries',GET('responseContent'))),iff(good,chain(*common,*success),failure))))
 r.append(event('webApi','Web','TimedOut',chain(SET('global apiBusy',BOOL(False)),*[copy.deepcopy(x) for x in restore],notice(T('Connection timed out. Please try again.')))))
 r.append(event(screen,'Form','ErrorOccurred',chain(SET('global apiBusy',BOOL(False)),*[copy.deepcopy(x) for x in restore],notice(GET('message')))))
 # Purple blocks retain readable descriptive names in the Blocks editor.
 for b in r.iter(q('block')):
  if b.get('type')=='component_method' and b.find(q('mutation')).get('component_type')=='FirebaseDB':raise RuntimeError('Legacy database block remains: '+screen)
  if b.get('type')=='component_set_get' and b.find(q('mutation')).get('component_type')=='FirebaseDB':raise RuntimeError('Legacy database property remains: '+screen)
 # Also update photo references copied from cached initialization statements.
 for b in r.iter(q('block')):
  m=b.find(q('mutation'))
  if m is not None and m.get('instance_name')=='imgPhoto' and m.get('property_name')=='Picture':
   m.set('component_type','WebViewer');m.set('property_name','WebViewString')
   for f in b.findall(q('field')):
    if f.get('name')=='PROP':f.text='WebViewString'
 # Event parameter metadata is used by App Inventor's lexical-variable renamer.
 for b in r.iter(q('block')):
  if b.get('type')=='lexical_variable_get':
   field=b.find(q('field'))
   if field is not None and field.text in ['responseCode','responseContent','value','message']:
    m=b.find(q('mutation'))
    if m is None:m=E.SubElement(b,q('mutation'))
    if m.find(q('eventparam')) is None:E.SubElement(m,q('eventparam'),{'name':field.text})
 # Reassign unique IDs: copied original blocks must not share Blockly IDs.
 for i,b in enumerate(r.iter(q('block'))):b.set('id',screen+'_BSS_'+str(i))
 p.write_text('#|\n$JSON\n'+json.dumps(doc,indent=1)+'\n|#\n')
 (folder/(screen+'.bky')).write_text(E.tostring(r,encoding='unicode'))
properties=root/'youngandroidproject/project.properties'
s=properties.read_text().replace('aname=Member Mobile App','aname=Barangay Health Center').replace('color.primary=&HFF101828','color.primary=&HFF1D6F5E').replace('color.primary.dark=&HFF101828','color.primary.dark=&HFF14483D').replace('color.accent=&HFFFFD23F','color.accent=&HFF1D6F5E').replace('versionname=1.0','versionname=2.0')
properties.write_text(s)
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(root.rglob('*')):
  if path.is_file():z.write(path,path.relative_to(root))
print('Built',dest)
