(function(root){
 'use strict';
 const kinds={order:'הזמנות שנסגרו',production:'שירות שניתן',payment:'גבייה מאומתת'};
 function localDate(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
 function shiftDate(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
 function weekStart(s){return shiftDate(s,-new Date(s+'T12:00:00Z').getUTCDay());}
 function cents(v){const s=String(v).trim().replace(/,/g,'');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('יש להזין סכום חיובי, עד שתי ספרות אחרי הנקודה');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0||n>1e11)throw Error('הסכום מחוץ לטווח');return n;}
 function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
 function validateEvent(e){if(!e||!Object.hasOwn(kinds,e.kind)||!validDate(e.date)||!['planned','actual'].includes(e.status)||!Number.isSafeInteger(e.amountCents)||e.amountCents<=0||e.amountCents>1e11||!e.jobId)throw Error('פרטי הפעולה אינם תקינים');return e;}
 function summaryId(start,status='actual'){return status+'_'+start;}
 function validateWeeklySummary(s){
  if(!s||!validDate(s.start)||weekStart(s.start)!==s.start||!['actual','planned'].includes(s.status)||s.id!==summaryId(s.start,s.status)||!['orderCents','productionCents','paymentCents'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0&&s[k]<=1e11))throw Error('פרטי הסיכום השבועי אינם תקינים');
  if(s.status==='actual'&&s.paymentCents>0&&s.paymentVerified!==true)throw Error('יש לאשר שהגבייה בסיכום התקבלה בפועל');return s;
 }
 function weekly(events,start,status='actual',summaries=[]){
  const days=Array.from({length:7},(_,i)=>shiftDate(start,i)),matches=summaries.filter(s=>s.start===start&&s.status===status);
  if(matches.length>1)throw Error('נמצא יותר מסיכום אחד לאותו שבוע ומצב');
  const summary=matches.length?validateWeeklySummary(matches[0]):null;
  return Object.keys(kinds).map(kind=>{const cells=days.map(date=>events.filter(e=>e.kind===kind&&e.date===date&&e.status===status&&(kind!=='payment'||status==='planned'||e.verified===true))),dailyTotal=cells.flat().reduce((s,e)=>s+e.amountCents,0),sourceTotal=summary?summary[kind+'Cents']:null;
   return {kind,cells,dailyTotal,sourceTotal,summary,total:sourceTotal===null?dailyTotal:sourceTotal,difference:sourceTotal===null?null:sourceTotal-dailyTotal};
  });
 }
 function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function csv(rows){return '\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
 function upsert(list,item){const i=list.findIndex(x=>x.id===item.id);return i<0?[...list,item]:list.map(x=>x.id===item.id?item:x);}
 const api={kinds,localDate,shiftDate,weekStart,cents,validDate,validateEvent,summaryId,validateWeeklySummary,weekly,csv,upsert};
 root.BusinessCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
