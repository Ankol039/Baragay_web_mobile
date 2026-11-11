const DAY = 86400000, OFFSET = 28800000
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const phpTrim = value => String(value).replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '')
export const instant = value => value instanceof Date ? value.getTime() : new Date(value).getTime()
export const iso = value => value instanceof Date ? value.toISOString() : String(value ?? '')
export const dateOnly = value => iso(value).slice(0,10)
export function manilaDay(value = new Date()) { return new Date(instant(value)+OFFSET).toISOString().slice(0,10) }
export const midnight = day => Date.parse(day+'T00:00:00+08:00')
export const addDays = (day, n) => new Date(Date.parse(day+'T00:00:00Z')+n*DAY).toISOString().slice(0,10)
export function label(value, time = false, fullMonth = false, padded = false) {
  if (!value) return ''
  const d = new Date(instant(value)+OFFSET), month = MONTHS[d.getUTCMonth()]
  const day = padded ? String(d.getUTCDate()).padStart(2,'0') : d.getUTCDate()
  return `${fullMonth ? month : month.slice(0,3)} ${day}, ${d.getUTCFullYear()}`
    +(time ? ` ${d.getUTCHours()%12||12}:${String(d.getUTCMinutes()).padStart(2,'0')} ${d.getUTCHours()<12?'AM':'PM'}` : '')
}
export function round(value, precision = 0) {
  const factor=10**precision
  return Math.sign(value)*Math.round((Math.abs(value)+Number.EPSILON)*factor)/factor || 0
}
export const countValues = values => { const counts=new Map(); for(const value of values) counts.set(value,(counts.get(value)||0)+1); return counts }
export function compare(a,b) {
  const fold=s=>String(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
  return cmp(fold(a),fold(b))
}
export const cmp = (a,b) => a===b?0:a<b?-1:1
export function delta(now,before) {
  if(!before) return now?['up',`+${Math.trunc(now)} new`]:['flat','No change']
  const change=round((now-before)/before*100)
  return change>0?['up',`+${change}%`]:change<0?['down',`${change}%`]:['flat','No change']
}
export function validDay(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
}
export function csvRow(row) {
  return row.map(value=>{
    const text=String(value ?? '')
    if(!/[,"\\\n\r\t ]/.test(text)) return text
    let escaped=false,result='"'
    for(const ch of text) {
      if(ch==='\\'&&!escaped) escaped=true
      else { if(ch==='"'&&!escaped) result+='"'; escaped=false }
      result+=ch
    }
    return result+'"'
  }).join(',')+'\n'
}
export function csvFilename(title) {
  return 'survey_report_'+Array.from(new TextEncoder().encode(title),n=>(n>=65&&n<=90)||(n>=97&&n<=122)||(n>=48&&n<=57)||n===95||n===45?String.fromCharCode(n):'_').join('')+'.csv'
}
