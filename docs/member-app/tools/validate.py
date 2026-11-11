import json,sys,zipfile,xml.etree.ElementTree as E
from collections import Counter
q=lambda x:'{http://www.w3.org/1999/xhtml}'+x
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 scms=[p for p in z.namelist() if p.endswith('.scm')]
 assert {p.rsplit('/',1)[-1] for p in scms}=={n+'.scm' for n in ['Screen1','Register','Home','Profile','EditProfile','Membership','FirebaseConnection']}
 total=0
 for name in scms:
  d=json.loads(z.read(name).decode().split('$JSON\n')[1].split('\n|#')[0]);components={}
  def walk(c):
   assert c['$Name'] not in components,c['$Name'];components[c['$Name']]=c['$Type']
   for ch in c.get('$Components',[]):walk(ch)
  walk(d['Properties'])
  r=E.fromstring(z.read(name.replace('.scm','.bky')));ids=[];events=[]
  for b in r.iter(q('block')):
   ids.append(b.get('id'));total+=1
   assert len(b.findall(q('next')))<=1,'Duplicate block next connection'
   m=b.find(q('mutation'))
   if m is not None and m.get('instance_name'):
    instance=m.get('instance_name');assert instance in components,(name,instance)
    assert components[instance]==m.get('component_type'),(name,instance,components[instance],m.get('component_type'))
    assert m.get('component_type')!='FirebaseDB'
    if b.get('type')=='component_event':events.append((instance,m.get('event_name')))
  assert len(ids)==len(set(ids)),name+' duplicate block IDs'
  assert len(events)==len(set(events)),name+' duplicate event'
  assert ('webApi','GotText') in events
  print(name.rsplit('/',1)[-1],len(components),'components;',len(ids),'blocks; references valid')
 print('PASS:',len(scms),'screens;',total,'blocks; ZIP, SCM JSON and BKY XML valid.')
