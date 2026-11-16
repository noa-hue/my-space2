const taskMeetingSource='task-meeting';

function taskMeetingFields(task,open){
 if(!task.id||task.repeatRule||(task.relatedType!=='job'&&taskAreaName(task)!=='עבודה-לקוחות'))return '';
 const meeting=state.appointments.find(item=>item.id===task.meetingId);
 if(meeting?.googleEventId)return `<div class="field"><strong>נקבעה פגישה</strong>
 <div>${fmtDate(meeting.date)} · <bdi>${e(meeting.start)}–${e(meeting.end)}</bdi> · ${e(clientMeetingStatus[meeting.status])}</div>
 ${meeting.url?`<a href="${e(meeting.url)}" target="_blank" rel="noopener noreferrer">פתיחה ועריכה ב־Google Calendar</a>`:''}</div>`;
 return `<details data-task-meeting class="section-space" ${open?'open':''}><summary>${meeting?'מועד הפגישה · '+fmtDate(meeting.date)+' · <bdi>'+e(meeting.start)+'</bdi>':'נקבעה פגישה'}</summary>
 <p class="small muted">הזיני מועד ושמרי כדי לסמן את המשימה כבוצעה ולהציג את הפגישה ביומן המרחב, בתיק הלקוח ובטבלה השבועית בתכנון.</p>
 ${field('תאריך הפגישה','meetingDate',meeting?.date,'date')}
 <div class="grid2">${field('תחילת הפגישה','meetingStart',meeting?.start,'time')}${field('סיום הפגישה','meetingEnd',meeting?.end,'time')}</div>
 ${CFG.mode==='demo'?'':`<label class="checkline"><input type="checkbox" name="meetingGoogle">להוסיף גם ליומן הראשי ב־Google Calendar</label>
 <p class="small muted">אם תבחרי בכך, תתווסף ל־Google פגישה פרטית בשם ״פגישה״. שם הלקוח יוצג במרחב.</p>`}
 </details>`;
}

function taskMeetingRecord(task,original,values){
 const job=task.relatedType==='job'&&state.jobs.find(item=>item.id===task.relatedId);
 if(!original.id||!job||task.repeatRule)throw Error('לקביעת פגישה בחרי משימה חד־פעמית ושייכי אותה לתיק לקוח.');
 const date=values.get('meetingDate'),start=values.get('meetingStart'),end=values.get('meetingEnd');
 if(!C.validDate(date)||!start||!end||C.minute(start)>=C.minute(end))throw Error('יש להזין תאריך, שעת התחלה ושעת סיום תקינים לפגישה.');
 const previous=state.appointments.find(item=>item.id===original.meetingId);
 if(previous?.googleEventId)throw Error('הפגישה כבר מקושרת ליומן Google. את המועד אפשר לעדכן שם.');
 if(previous&&previous.jobId!==job.id)throw Error('הפגישה כבר שויכה לתיק אחר. בחרי את התיק המקורי כדי לעדכן את מועד הפגישה.');
 const existing=!previous&&state.appointments.find(item=>isClientMeeting(item)&&item.jobId===job.id&&item.status==='scheduled'&&item.date===date&&item.start===start&&item.end===end);
 return existing||{...previous,id:previous?.id||'task-meeting-'+task.id,source:taskMeetingSource,kind:'meeting',
  title:'פגישה עם '+job.name,jobId:job.id,status:'scheduled',date,start,end,sourceTaskId:task.id};
}

async function saveTaskMeeting(task,original,values){
 const adapter=storeAdapter;
 const meeting=taskMeetingRecord(task,original,values);
 const addToGoogle=values.has('meetingGoogle')&&!meeting.googleEventId;
 let connectionError;
 if(addToGoogle&&!googleWriteToken){
  try{
   const token=await requestGoogleCalendarToken(true);
   if(adapter===storeAdapter)googleWriteToken=token;
  }
  catch(error){connectionError=error;}
 }
 if(adapter!==storeAdapter||!adapter)throw Error('החיבור למרחב השתנה. התחברי שוב.');
 const records=state.appointments.includes(meeting)?[]:[{type:'appointments',item:meeting}];
 await persistTask({...task,meetingId:meeting.id,status:'done',done:true},records);
 dayPlan=null;
 if(addToGoogle){
  try{
   if(connectionError)throw Error('כדי להוסיף אותה ל־Google יש לאשר את החיבור.');
   await addTaskMeetingToGoogle(meeting);
  }catch(error){
   throw Error('הפגישה נשמרה במרחב. ההוספה ל־Google עדיין דורשת בדיקה. '+error.message+' אפשר לנסות שוב דרך אותה משימה.');
  }
 }
 return meeting;
}

async function addTaskMeetingToGoogle(meeting){
 if(busy||!storeAdapter)throw Error('יש להמתין לסיום השמירה.');
 const adapter=storeAdapter;
 busy=true;
 try{
  const calendar=await googleGet('users/me/calendarList/primary',{},{write:true});
  if(!calendar.id||calendar.accessRole!=='owner')throw Error('היומן הראשי אינו זמין לכתיבה.');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(meeting.id));
  const id='noameeting'+Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  const path='calendars/'+encodeURIComponent(calendar.id)+'/events';
  const timeZone='Asia/Jerusalem';
  const body={id,summary:'פגישה',visibility:'private',
   start:{dateTime:meeting.date+'T'+meeting.start+':00',timeZone},
   end:{dateTime:meeting.date+'T'+meeting.end+':00',timeZone}};
  if(adapter!==storeAdapter)throw Error('החיבור למרחב השתנה. התחברי שוב.');
  let event;
  try{event=await googleGet(path,{sendUpdates:'none'},{body,write:true});}
  catch(error){
   if(error.httpStatus!==409)throw error;
   event=await googleGet(path+'/'+id,{},{write:true});
  }
  const linked=GC.clientMeetingRecord(event,calendar.id,meeting.jobId,meeting,'manual');
  if(!linked||linked.status!=='scheduled'||linked.date!==meeting.date||linked.start!==meeting.start||linked.end!==meeting.end)
   throw Error('כבר קיימת רשומה לפגישה הזו ב־Google במועד אחר או בסטטוס שונה.');
  if(adapter!==storeAdapter)throw Error('החיבור למרחב השתנה. התחברי שוב.');
  const saved=await adapter.saveClientMeetings([{previous:meeting,next:linked}],true);
  if(adapter===storeAdapter)for(const item of saved)state.appointments=C.upsert(state.appointments,item);
 }finally{busy=false;}
}
