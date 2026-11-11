import { metadata } from './policy-metadata.mjs'
import { fail } from './core/errors.mjs'
export const phpTrim = value => String(value ?? '').replace(/^[ \t\n\r\0\x0b]+|[ \t\n\r\0\x0b]+$/g, '')
export const byteLength = value => new TextEncoder().encode(String(value)).length
export const charLength = value => [...String(value)].length
export const PROFILE_PERSON = { courtesy_title: 'courtesyTitle', first_name: 'firstName', middle_name: 'middleName', last_name: 'lastName', name_extension: 'nameExtension', gender: 'gender' }
export const PROFILE_ADDRESS = { household_number: 'householdNumber', purok: 'purok', street_highway: 'streetHighway', barangay: 'barangay', municipality: 'municipality', postal_code: 'postalCode', province: 'province' }
const clone = value => structuredClone(value)
export const genderOptions = () => clone(metadata.gender)
export const residenceTypes = () => clone(metadata.residence)
export const courtesyTitles = () => clone(metadata.titles)
export const categoryReferenceFields = () => clone(metadata.categories)
export const addressFieldNames = () => [...metadata.addresses]
export const addressFieldLabels = () => clone(metadata.addressLabels)
export const requiredAddressFields = () => [...metadata.requiredAddresses]
export const personFieldKeys = () => Object.keys(PROFILE_PERSON)
export const personFieldSpec = () => clone(metadata.profile.person)
export const profileMetadata = () => clone(metadata.profile)
export const contactNumberPattern = () => metadata.profile.contact_pattern
export const hotlineNumberPattern = () => metadata.profile.hotline_pattern
export const hotlineFormatHint = () => metadata.profile.hotline_hint
export const permanentResidencyMinMonths = () => 6
export const profileMap = (row, keys) => Object.fromEntries(Object.entries(keys).map(([old, key]) => [key, String(row?.[old] ?? '')]))
export const profileUnmap = (row, keys) => Object.fromEntries(Object.entries(keys).map(([old, key]) => [old, String(row?.[key] ?? '')]))
export function profileStrings(input, keys) { return Object.fromEntries(keys.map(key => { if (input[key] != null && typeof input[key] !== 'string') fail(`Invalid request field: ${key}.`); return [key, phpTrim(input[key])] })) }
export const genderLabel = value => metadata.gender[value] || ({male:'Man',female:'Woman'}[value]) || 'N/A'
export const residenceTypeLabel = value => (metadata.residence[value] || '').split(' - ').slice(1).join(' - ')
export const withCourtesyTitle = (title, name) => phpTrim(title) ? `${phpTrim(title)} ${name}` : name
export const buildFullName = (...parts) => parts.slice(0,4).map(phpTrim).filter(x => x !== '').join(' ').replace(/[\x09-\x0d ]+/g, ' ')
export const buildAddressLine = (...parts) => parts.slice(0,7).map(phpTrim).filter(x => x !== '').join(', ')
export function resolveCourtesyTitle(selected, custom = '') { selected=phpTrim(selected); if(selected === 'Others') return new TextDecoder('utf-8',{fatal:true}).decode(new TextEncoder().encode(phpTrim(custom)).slice(0,20)); return metadata.titles.includes(selected) ? selected : '' }
export function accountInitial(first, display = '', title = '', fallback = '?') {
  first=phpTrim(first)
  if(!first){let name=phpTrim(display);title=phpTrim(title);if(title && name.slice(0,title.length).toLowerCase()===title.toLowerCase())name=phpTrim(name.slice(title.length));for(let word of name.split(/[\x09-\x0d ]+/)){word=word.replace(/^[.,-]+|[.,-]+$/g,'');if(word && !/^(mr|mrs|ms|mx|dr|engr|ar|atty|hon|prof|rev|sr|jr|fr|sis|bro)$/i.test(word)){first=word;break}}}
  first=first.replace(/[^\p{L}\p{N}]/gu,'');return [...(first || fallback)][0].toUpperCase()
}
export function formatPersonName(row, withTitle = true) { return [withTitle ? row?.courtesy_title : '',row?.first_name,row?.middle_name,row?.last_name,row?.name_extension].map(phpTrim).filter(x=>x!=='').join(' ') }
export function personFieldDisplay(field,value) { value=phpTrim(value);return !value?'N/A':field==='gender'?(metadata.gender[value]||value):value }
export function profilePerson(row) { return {...Object.fromEntries(personFieldKeys().map(k=>[k,personFieldDisplay(k,row?.[k])])),full_name:formatPersonName(row)} }
export function collectPersonRows(rows) { if(!Array.isArray(rows))return [];return rows.filter(row=>row && typeof row==='object' && !Array.isArray(row)).map(row=>{const entry=Object.fromEntries(personFieldKeys().map(k=>[k,phpTrim(row[k])]));entry.courtesy_title=resolveCourtesyTitle(entry.courtesy_title,row.courtesy_title_other);return entry}).filter(row=>formatPersonName(row)!=='') }
export function personRowsErrors(rows,noun) { const out=[];for(const [i,row]of rows.entries())for(const [key,spec]of Object.entries(metadata.profile.person))if(spec.required && !phpTrim(row[key]))out.push(`${noun} ${i+1} needs a ${spec.label.toLowerCase()}.`);return out }
export const validContactNumber = value => !phpTrim(value) || /^[0-9+()\-\x09-\x0d ]{7,20}$/.test(phpTrim(value))
export const addressFieldMaxlength = key => metadata.profile.address[key]?.maxlength ?? 100
export function overlongAddressFields(values,prefix='') { return addressFieldNames().filter(key=>charLength(phpTrim(values[key]))>addressFieldMaxlength(key)).map(key=>`${prefix}${metadata.addressLabels[key]} (max ${addressFieldMaxlength(key)} characters)`) }
export const validCategoryReference = (category,value) => !metadata.categories[category] || new RegExp(`^${metadata.categories[category].pattern}$`,'i').test(phpTrim(value))
export function validWrittenText(value,min=5){value=phpTrim(value);if(charLength(value)<min||!/[\p{L}]/u.test(value)||new Set([...value.toLowerCase()]).size<3)return false;const flat=value.toLowerCase().replace(/[^a-z]/g,'');return !['qwerty','asdf','zxcv','qwertyuiop','asdfgh'].some(mash=>flat!==''&&mash.startsWith(flat))}
export const passwordRules = () => Object.entries(metadata.password).map(([key,label])=>({key,label}))
export function passwordPolicyErrors(value){return passwordRules().filter(({key})=>!({length:byteLength(value)>=8,upper:/[A-Z]/.test(value),lower:/[a-z]/.test(value),number:/[0-9]/.test(value),space:!/[\x09-\x0d ]/.test(value)})[key]).map(r=>r.label)}
export const dateOnly = value => !value ? '' : value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10)
export const today = (now=new Date()) => new Date(now.getTime()+8*3600000).toISOString().slice(0,10)
export function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value}
export function residencyDuration(start,asOf=today()){start=dateOnly(start);asOf=dateOnly(asOf);if(!validDate(start)||!validDate(asOf)||start>asOf)return null;const a=new Date(start+'T00:00:00Z'),b=new Date(asOf+'T00:00:00Z');let days=b.getUTCDate()-a.getUTCDate(),count=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth(),month=b.getUTCMonth();while(days<0){days+=new Date(Date.UTC(b.getUTCFullYear(),month--,0)).getUTCDate();count--}return {years:Math.floor(count/12),months:count%12,days,total_months:count}}
export function formatResidencyDuration(d){const parts=['years','months','days'].filter(k=>d[k]).map(k=>`${d[k]} ${k.slice(0,-1)}${d[k]===1?'':'s'}`);if(!parts.length)return 'less than a day';if(parts.length===1)return parts[0];const last=parts.pop();return parts.join(', ')+' and '+last}
export function getResidentAgeLabel(value,now=today()){const key=dateOnly(value);if(!key)return 'N/A';const d=new Date(key+'T00:00:00Z');if(!Number.isFinite(d.getTime()))return 'N/A';let a=d,b=new Date(now+'T00:00:00Z');if(a>b)[a,b]=[b,a];let years=b.getUTCFullYear()-a.getUTCFullYear();if(b.getUTCMonth()<a.getUTCMonth()||(b.getUTCMonth()===a.getUTCMonth()&&b.getUTCDate()<a.getUTCDate()))years--;return `${years} years old`}
const months=['January','February','March','April','May','June','July','August','September','October','November','December']
export function dateTime(value,pattern='M j, Y g:i A'){if(!value)return '';let d=value instanceof Date?value:new Date(/^\d{4}-\d{2}-\d{2} \d/.test(value)?value.replace(' ','T')+'+08:00':value);d=new Date(d.getTime()+8*3600000);if(!Number.isFinite(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0'),h=d.getUTCHours(),map={Y:d.getUTCFullYear(),m:pad(d.getUTCMonth()+1),n:d.getUTCMonth()+1,d:pad(d.getUTCDate()),j:d.getUTCDate(),F:months[d.getUTCMonth()],M:months[d.getUTCMonth()].slice(0,3),H:pad(h),G:h,g:h%12||12,h:pad(h%12||12),i:pad(d.getUTCMinutes()),s:pad(d.getUTCSeconds()),A:h<12?'AM':'PM',a:h<12?'am':'pm'};return pattern.replace(/\\(.)|[Ymn djFMHGghisAa]/g,(token,escaped)=>escaped??map[token]??token)}
export function loginTypeLabel(row){const mapping={Admin:['admin'],Staff:['staff'],'Permanent Resident':['permanent'],'Temporary Resident':['temporary']};let text=phpTrim(row.account_role);if(!mapping[text])text=row.user_type==='staff'?(phpTrim(row.staff_role).toLowerCase()==='admin'?'Admin':'Staff'):(phpTrim(row.residency_status??'permanent').toLowerCase()==='temporary'?'Temporary Resident':'Permanent Resident');const kind=mapping[text][0];return {text,pill:'db-pill-'+kind,badge:'badge-'+kind}}
export { validWrittenText as valid_written_text, genderOptions as gender_options, loginTypeLabel as login_type_label }
