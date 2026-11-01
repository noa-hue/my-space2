(function(root){
 'use strict';
 function minute(value){if(!/^\d{2}:\d{2}$/.test(value))throw Error('יש להזין שעה תקינה');const [h,m]=value.split(':').map(Number);if(h>23||m>59)throw Error('יש להזין שעה תקינה');return h*60+m;}
 function clock(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
 function planDay({date,start='09:00',end='17:00',buffer=10,appointments=[],tasks=[]}){
  const a=minute(start),b=minute(end);if(b<=a||!Number.isInteger(buffer)||buffer<0||buffer>60)throw Error('יש לבדוק את שעות היום ואת מרווח המעבר');
  const busy=appointments.filter(x=>x.date===date).map(x=>[Math.max(a,minute(x.start)-buffer),Math.min(b,minute(x.end)+buffer)]).filter(([s,e])=>s<e).sort((x,y)=>x[0]-y[0]);
  const merged=[];for(const x of busy){const last=merged[merged.length-1];if(last&&x[0]<=last[1])last[1]=Math.max(last[1],x[1]);else merged.push([...x]);}
  const slots=[];let cursor=a;for(const [s,e] of merged){if(s>cursor)slots.push([cursor,s]);cursor=Math.max(cursor,e);}if(cursor<b)slots.push([cursor,b]);
  const rank={high:0,medium:1,low:2};const candidates=[...tasks].sort((x,y)=>(rank[x.urgency]??3)-(rank[y.urgency]??3)||(x.due||'9999').localeCompare(y.due||'9999')||String(x.id).localeCompare(String(y.id)));
  const scheduled=[],skipped=[],seen=new Set(appointments.filter(x=>x.date===date&&x.sourceTaskId).map(x=>x.sourceTaskId));
  for(const t of candidates){
   let reason='';
   if(seen.has(t.id))reason='already';
   else if(t.done||['done','waiting','review'].includes(t.status))reason='inactive';
   else if(t.plannedDate&&t.plannedDate>date)reason='future';
   else if(tasks.some(child=>child.parentId===t.id))reason='parent';
   else if(!Number.isInteger(t.estimatedMinutes)||t.estimatedMinutes<1)reason='duration';
   if(reason){skipped.push({task:t,reason});continue;}
   const slot=slots.find(x=>x[1]-x[0]>=t.estimatedMinutes);
   if(!slot){skipped.push({task:t,reason:'capacity'});continue;}
   const startAt=slot[0],endAt=startAt+t.estimatedMinutes;slot[0]=Math.min(slot[1],endAt+buffer);seen.add(t.id);
   scheduled.push({task:t,start:clock(startAt),end:clock(endAt)});
  }
  return {scheduled,skipped,totalMinutes:scheduled.reduce((n,x)=>n+x.task.estimatedMinutes,0)};
 }
 const api={minute,clock,planDay};Object.assign(root.BusinessCore||(root.BusinessCore={}),api);if(typeof module!=='undefined')module.exports=api;
})(globalThis);
