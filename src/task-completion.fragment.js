function taskWritePlan(original,next,now=new Date().toISOString()){
 const recurring=!!next.repeatRule;const occurrenceDay=C.localDate(new Date(now));if(recurring)next=NoaRecurrence.complete(next,next.status||(next.done?'done':'todo'),occurrenceDay,now);
 const done=recurring?next.status==='done':taskStatus(next)==='done',wasDone=taskStatus(original)==='done';
 const noteId='task-completion-'+next.id+(recurring?'-'+NoaRecurrence.occurrence(next,occurrenceDay):''),old=state.notes.find(n=>n.id===noteId&&n.recordType==='task-completion');
 const item={...next,done,status:recurring?next.status:taskStatus(next),updatedAt:now};
 if(recurring)item.completedAt=done?item.repeatCompletions[NoaRecurrence.occurrence(item,occurrenceDay)]:'';
 else if(done&&!wasDone)item.completedAt=now;
 else if(!done)item.completedAt='';
 const records=[{type:'tasks',item}];
 if(done&&item.completedAt&&next.relatedType==='job'&&next.relatedId){
  if(!state.jobs.some(j=>j.id===next.relatedId))throw Error('התיק המשויך למשימה אינו זמין. יש לעדכן את השיוך לפני סימון הביצוע.');
  records.push({type:'notes',item:{...old,id:noteId,recordType:'task-completion',taskId:next.id,jobId:next.relatedId,text:'בוצעה משימה: '+next.text,taskText:next.text,completedAt:item.completedAt,date:C.localDate(new Date(item.completedAt)),status:'completed',revokedAt:'',createdAt:old?.createdAt||now,updatedAt:now}});
 }else if(old&&old.status!=='revoked'){
  records.push({type:'notes',item:{...old,status:'revoked',revokedAt:now,updatedAt:now}});
 }
 return records;
}
async function persistTask(item){
 if(busy)throw Error('פעולת שמירה כבר מתבצעת');
 const records=taskWritePlan(state.tasks.find(t=>t.id===item.id)||{},item);
 busy=true;saveLabel='שומרת…';const status=$('#save-state');if(status)status.textContent=saveLabel;
 try{await storeAdapter.writeRecords(records);for(const record of records)state[record.type]=C.upsert(state[record.type],record.item);saveLabel=CFG.mode==='demo'?'נשמר בדפדפן הזה':'נשמר בענן';}
 catch(err){saveLabel='השמירה לא הושלמה';throw err;}finally{busy=false;}
}
function jobTaskUpdates(jobId){
 const updates=state.notes.filter(n=>n.recordType==='task-completion'&&n.jobId===jobId).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
 return `<h3 class="section-title">עדכונים בתיק</h3>${updates.map(n=>`<div class="activity"><div class="spaced"><strong>${n.status==='revoked'?'סימון הביצוע בוטל':'בוצעה משימה'}</strong><span class="small muted">${e(new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Jerusalem'}).format(new Date(n.status==='revoked'?n.revokedAt:n.completedAt)))}</span></div><p>${e(n.taskText)}</p>${n.status==='revoked'?'<div class="small muted">המשימה נפתחה מחדש או שהוסרה ממנה השייכות לתיק. העדכון נשמר לתיעוד.</div>':''}</div>`).join('')||empty('עדיין אין עדכוני ביצוע בתיק')}`;
}
