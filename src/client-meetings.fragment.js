const clientMeetingSetting='noa-client-meetings-'+CFG.ownerUid;
const meetingFields='id,summary,start,end,status,visibility,transparency,eventType,updated,htmlLink,attendees(email,self,resource,responseStatus)';
let clientMeetingSync={calendarId:'',candidates:[],loading:false,checkedAt:0,error:''};
const isClientMeeting=meeting=>meeting.source===GC.clientMeetingSource;
const clientMeetingStatus={scheduled:'מתוכננת',cancelled:'בוטלה',excluded:'דרוש שיוך מחדש',unavailable:'לא זמינה ביומן'};

async function saveCloudClientMeetings(api,db,uid,items,manual){
 return api.runTransaction(db,async transaction=>{
  const refs=items.map(({next})=>api.doc(db,'users',uid,'appointments',next.id));
  const existing=await Promise.all(refs.map(ref=>transaction.get(ref)));
  return items.flatMap(({previous,next},index)=>{
   const current=existing[index].data();
   const sameVersion=current===undefined?previous===undefined:
    previous!==undefined&&Object.keys(current).length===Object.keys(previous).length&&
    Object.keys(current).every(key=>current[key]===previous[key]);
   if(!sameVersion){
    if(manual)throw Error('השיוך השתנה בדפדפן אחר. רענני את הטבלה ונסי שוב.');
    return current&&isClientMeeting(current)?[current]:[];
   }
   transaction.set(refs[index],next);
   return [next];
  });
 });
}

function clientMeetingSettings(){
 const sync=clientMeetingSync;
 const options={'':'ללא סנכרון',...Object.fromEntries(googleCalendar.calendars.map(calendar=>[calendar.id,calendar.summary||calendar.id]))};
 return `<section class="panel section-space">
  <h2>פגישות לקוחות בתיקים ובטבלה השבועית</h2>
  <p class="small muted">בחרי יומן אחד לסנכרון מהשבוע הנוכחי ולחמישה שבועות קדימה. כל עוד האפליקציה פתוחה ומחוברת ל־Google, פגישות עם התאמה לפי מייל יתווספו אוטומטית. אפשר לשייך פגישות נוספות מהטבלה השבועית.</p>
  ${googleCalendar.token?`<label class="small" for="client-meeting-calendar">יומן לסנכרון</label>
  <div class="toolbar"><select id="client-meeting-calendar">${Object.entries(options).map(([id,name])=>`<option value="${e(id)}" ${id===sync.calendarId?'selected':''}>${e(name)}</option>`).join('')}</select>
  ${sync.calendarId?btn('לסנכרן עכשיו','client-meetings-refresh'):''}</div>`:''}
  <p id="client-meeting-status" class="small" role="status">${e(sync.error)}</p>
 </section>`;
}

function chooseClientMeetingCalendar(id){
 const allowed=googleCalendar.calendars.some(calendar=>calendar.id===id);
 clientMeetingSync={calendarId:allowed?id:'',candidates:[],loading:false,checkedAt:0,error:''};
 try{localStorage.setItem(clientMeetingSetting,clientMeetingSync.calendarId);}catch{}
 render();
 if(allowed)void refreshClientMeetings();
}

function restoreClientMeetingCalendar(){
 let id='';
 try{id=localStorage.getItem(clientMeetingSetting)||'';}catch{}
 if(id&&googleCalendar.calendars.some(calendar=>calendar.id===id)){
  clientMeetingSync={calendarId:id,candidates:[],loading:false,checkedAt:0,error:''};
  void refreshClientMeetings();
 }
}

function clientMeetingItem(event,calendarId,previous){
 const status=GC.meetingStatus(event);
 if(status==='excluded')return previous?{...previous,status}:null;
 if(status==='cancelled')return GC.clientMeetingRecord(event,calendarId,'',previous,'');
 const match=GC.matchClientMeeting(event,state.jobs,state.contacts,cloud?.auth.currentUser?.email,calendarId);
 if(previous?.matchedBy==='manual'&&state.jobs.some(job=>job.id===previous.jobId))return GC.clientMeetingRecord(event,calendarId,previous.jobId,previous,'manual');
 if(previous&&match!==previous.jobId)return {...previous,status:'excluded'};
 return match?GC.clientMeetingRecord(event,calendarId,match,previous,'email'):null;
}

async function refreshClientMeetings(){
 const sync=clientMeetingSync, calendarId=sync.calendarId, connection=googleCalendar;
 if(!calendarId||!connection.token||!storeAdapter||sync.loading||busy||modal.open||dirty)return;
 const firstDay=C.weekStart(C.localDate()),lastDay=C.shiftDate(firstDay,42);
 const path='calendars/'+encodeURIComponent(calendarId)+'/events';
 let changed=false;
 sync.loading=true;
 sync.error='';
 try{
  const events=await googlePages(path,{
   timeMin:GC.bounds(firstDay).timeMin,timeMax:GC.bounds(lastDay).timeMin,
   singleEvents:true,showDeleted:true,maxResults:2500,fields:`nextPageToken,items(${meetingFields})`
  });
  const byId=new Map(events.map(event=>[event.id,event]));
  const known=state.appointments.filter(meeting=>isClientMeeting(meeting)&&meeting.calendarId===calendarId);
  const missing=known.filter(meeting=>meeting.date>=firstDay&&meeting.date<lastDay&&!byId.has(meeting.googleEventId)&&meeting.status!=='cancelled');
  for(const meeting of missing){
   if(sync!==clientMeetingSync||connection!==googleCalendar||!connection.token)return;
   try{byId.set(meeting.googleEventId,await googleGet(path+'/'+encodeURIComponent(meeting.googleEventId),{fields:meetingFields}));}
   catch(error){
    if(error.httpStatus!==404&&error.httpStatus!==410)throw error;
    byId.set(meeting.googleEventId,{id:meeting.googleEventId,unavailable:true});
   }
  }
  if(sync!==clientMeetingSync||connection!==googleCalendar||!connection.token||!storeAdapter||busy||modal.open||dirty)return;
  const updates=[], candidates=[];
  for(const event of byId.values()){
   if(!event.id)continue;
   const id=GC.clientMeetingKey(calendarId,event.id);
   const previous=state.appointments.find(meeting=>meeting.id===id&&isClientMeeting(meeting));
   const next=event.unavailable?(previous&&{...previous,status:'unavailable'}):clientMeetingItem(event,calendarId,previous);
   if(next&&Object.keys(next).some(key=>next[key]!==previous?.[key]))updates.push({previous,next});
   if((!next||next.status==='excluded')&&GC.meetingStatus(event)==='scheduled')candidates.push(event);
  }
  if(updates.length){
   await persistClientMeetings(updates);
   dayPlan=null;
  }
  if(sync!==clientMeetingSync||connection!==googleCalendar)return;
  changed=updates.length>0||JSON.stringify(sync.candidates)!==JSON.stringify(candidates);
  sync.candidates=candidates;
  sync.checkedAt=Date.now();
 }catch(error){
  if(sync===clientMeetingSync){
   sync.checkedAt=Date.now();
   sync.error=connection.token?'סנכרון הפגישות לא הושלם. נסי שוב דרך היומן.':'הרשאת היומן פגה. התחברי שוב כדי להמשיך בסנכרון.';
   changed=!connection.token;
  }
 }finally{
  sync.loading=false;
  if(sync===clientMeetingSync&&['calendar','weekly'].includes(page)&&!modal.open&&!dirty&&!busy){
   if(changed){
    const expanded=document.getElementById('client-meeting-review')?.open;
    render();
    const review=document.getElementById('client-meeting-review');
    if(review&&expanded)review.open=true;
   }else{
    const status=document.getElementById('client-meeting-status');
    if(status)status.textContent=sync.error;
   }
  }
 }
}

async function persistClientMeetings(items,manual=false){
 const adapter=storeAdapter;
 busy=true;
 try{
  for(let i=0;i<items.length;i+=100){
   const saved=await adapter.saveClientMeetings(items.slice(i,i+100),manual);
   if(adapter!==storeAdapter)return;
   for(const meeting of saved)state.appointments=C.upsert(state.appointments,meeting);
  }
  saveLabel='נשמר בענן';
 }finally{busy=false;}
}

function editClientMeeting(eventId){
 const event=clientMeetingSync.candidates.find(candidate=>candidate.id===eventId);
 if(!event||!state.jobs.length)return;
 showDialog('שיוך פגישה לתיק',form('client-meeting','',
  `<input type="hidden" name="googleEventId" value="${e(eventId)}"><p>${e(event.summary||'אירוע ללא כותרת')} · ${fmtDate(GC.dayAt(event.start.dateTime))} · ${GC.clockAt(event.start.dateTime)}</p>`+
  select('תיק הלקוח','jobId','',{'':'בחרי תיק',...Object.fromEntries(state.jobs.map(job=>[job.id,job.name]))})
 ));
}
async function submitClientMeeting(formData){
 const sync=clientMeetingSync;
 const event=sync.candidates.find(candidate=>candidate.id===formData.get('googleEventId'));
 const job=state.jobs.find(item=>item.id===formData.get('jobId'));
 if(!event||!job||!googleCalendar.token||!storeAdapter)throw Error('יש לבחור פגישה ותיק לקוח זמינים.');
 const path='calendars/'+encodeURIComponent(sync.calendarId)+'/events/'+encodeURIComponent(event.id);
 const latest=await googleGet(path,{fields:meetingFields});
 if(sync!==clientMeetingSync||!storeAdapter||GC.meetingStatus(latest)!=='scheduled')throw Error('הפגישה השתנתה ביומן. יש לסנכרן שוב.');
 const record=GC.clientMeetingRecord(latest,sync.calendarId,job.id,null,'manual');
 if(!record)throw Error('הפגישה אינה זמינה לשיוך.');
 if(busy)throw Error('יש שמירה שמתבצעת כרגע.');
 const previous=state.appointments.find(meeting=>meeting.id===record.id);
 await persistClientMeetings([{previous,next:record}],true);
 sync.candidates=sync.candidates.filter(candidate=>candidate.id!==event.id);
 modal.close();render();toast('הפגישה שויכה לתיק ומופיעה בטבלה השבועית.');
}

function clientMeetingWeekRow(days){
 const byDay=days.map(day=>state.appointments.filter(meeting=>isClientMeeting(meeting)&&meeting.date===day&&meeting.status==='scheduled').sort((a,b)=>a.start.localeCompare(b.start)));
 return `<tr class="metric-row-client-meetings"><th scope="row">פגישות לקוחות<span class="ledger-status ledger-status-planned">תכנון · יומן Google</span></th>
 ${byDay.map(meetings=>`<td>${meetings.map(meeting=>`<button class="event-item" data-action="job-detail" data-id="${e(meeting.jobId)}">${e(jobName(meeting.jobId))}<strong><bdi>${e(meeting.start)}</bdi></strong></button>`).join('')||'<span class="muted">—</span>'}</td>`).join('')}
 <td class="total">${byDay.flat().length} פגישות</td></tr>`;
}
function clientMeetingReview(days){
 const candidates=clientMeetingSync.candidates.filter(event=>days.includes(GC.dayAt(event.start.dateTime)));
 if(!candidates.length)return '';
 return `<details id="client-meeting-review" class="panel section-space"><summary>אירועים מהיומן שאפשר לשייך · ${candidates.length}</summary>
 ${candidates.map(event=>`<div class="activity spaced"><span>${e(event.summary||'אירוע ללא כותרת')} · ${fmtDate(GC.dayAt(event.start.dateTime))} · ${GC.clockAt(event.start.dateTime)}</span>${btn('שיוך לתיק','client-meeting-link',event.id)}</div>`).join('')}</details>`;
}
function caseGoogleMeetings(jobId){
 const meetings=state.appointments.filter(meeting=>isClientMeeting(meeting)&&meeting.jobId===jobId).sort((a,b)=>b.startsAt.localeCompare(a.startsAt));
 if(!meetings.length)return '';
 return `<h3 class="section-title">פגישות מיומן Google</h3>${meetings.map(meeting=>`<div class="activity spaced"><span>${e(meeting.title)} · ${fmtDate(meeting.date)} · <bdi>${e(meeting.start)}</bdi></span>${badge(clientMeetingStatus[meeting.status]||'',meeting.status==='scheduled'?'':'gray')}</div>`).join('')}`;
}

function savedDayAppointments(google){
 return state.appointments.filter(meeting=>!isClientMeeting(meeting)).filter(meeting=>!google.some(event=>
  meeting.date===event.date&&meeting.start===event.start&&meeting.end===event.end&&
  (meeting.title===event.title||event.url&&meeting.notes?.includes(event.url))
 ));
}
function displayedGoogleMeetings(){
 const live=googleDayEvents();
 const ids=new Set(live.map(event=>event.id));
 const saved=state.appointments.filter(meeting=>isClientMeeting(meeting)&&meeting.status==='scheduled').map(meeting=>GC.normalize({
  id:meeting.googleEventId,summary:meeting.title,htmlLink:meeting.url,
  start:{dateTime:meeting.startsAt},end:{dateTime:meeting.endsAt}
 },{id:meeting.calendarId,summary:'Google Calendar'},calendarDay)).filter(event=>event&&!ids.has(event.id));
 return [...live,...saved];
}

document.addEventListener('change',event=>{
 if(event.target.id==='client-meeting-calendar')chooseClientMeetingCalendar(event.target.value);
});
setInterval(()=>{
 if(!document.hidden&&Date.now()-clientMeetingSync.checkedAt>=120000)void refreshClientMeetings();
},30000);
