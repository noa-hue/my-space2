(function(root){
'use strict';
const TZ='Asia/Jerusalem';
function parts(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))throw Error('Invalid event time');return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));}
function dayAt(value){const p=parts(value);return `${p.year}-${p.month}-${p.day}`;}
function clockAt(value){const p=parts(value);return p.hour+':'+p.minute;}
function shift(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function midnight(day){let ms=Date.parse(day+'T00:00:00Z');const target=ms;for(let i=0;i<4;i++){const p=parts(ms);const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);ms+=target-represented;}return ms;}
function bounds(day){return {timeMin:new Date(midnight(day)).toISOString(),timeMax:new Date(midnight(shift(day,1))).toISOString()};}
function normalize(ev,cal,day){
 if(ev.status==='cancelled'||ev.attendees?.some(x=>x.self&&x.responseStatus==='declined'))return null;
 const allDay=!!ev.start?.date;let start,end,visible;
 if(allDay){visible=ev.start.date<=day&&ev.end?.date>day;start='00:00';end='23:59';}
 else {const a=Date.parse(ev.start?.dateTime),b=Date.parse(ev.end?.dateTime),lo=midnight(day),hi=midnight(shift(day,1));visible=Number.isFinite(a)&&Number.isFinite(b)&&b>a&&a<hi&&b>lo;start=a<=lo?'00:00':clockAt(a);end=b>=hi?'23:59':clockAt(b);}
 if(!visible)return null;
 return {id:'google:'+cal.id+':'+ev.id,google:true,date:day,start,end,allDay,title:ev.summary||'אירוע ללא כותרת',kind:'meeting',calendarName:cal.summary||cal.id,busy:ev.transparency!=='transparent'&&ev.eventType!=='workingLocation',url:/^https:\/\/(calendar\.google\.com|www\.google\.com)\//.test(ev.htmlLink||'')?ev.htmlLink:''};
}
const clientMeetingSource='google-calendar';
function clientMeetingKey(calendarId,eventId){
 return 'google-meeting:'+encodeURIComponent(calendarId)+':'+encodeURIComponent(eventId);
}
function meetingStatus(event){
 if(event.status==='cancelled'||event.attendees?.some(attendee=>attendee.self&&attendee.responseStatus==='declined'))return 'cancelled';
 if(event.transparency==='transparent'||event.eventType&&event.eventType!=='default')return 'excluded';
 const start=Date.parse(event.start?.dateTime),end=Date.parse(event.end?.dateTime);
 return Number.isFinite(start)&&Number.isFinite(end)&&start<end?'scheduled':'excluded';
}
function matchClientMeeting(event,jobs,contacts,ownerEmail='',calendarId=''){
 if(event.visibility==='private'||event.visibility==='confidential')return '';
 const normalizeEmail=value=>String(value||'').trim().toLowerCase();
 const ignored=new Set([normalizeEmail(ownerEmail),normalizeEmail(calendarId)]);
 const emails=new Set((event.attendees||[]).filter(attendee=>!attendee.self&&!attendee.resource&&attendee.responseStatus!=='declined').map(attendee=>normalizeEmail(attendee.email)).filter(email=>email&&!ignored.has(email)));
 const contactIds=new Set(contacts.filter(contact=>emails.has(normalizeEmail(contact.email))).map(contact=>contact.id));
 const matches=jobs.filter(job=>job.stage!=='complete'&&contactIds.has(job.contactId));
 return matches.length===1?matches[0].id:'';
}
function clientMeetingRecord(event,calendarId,jobId,previous,matchedBy){
 const status=meetingStatus(event);
 if(status!=='scheduled'&&(!previous||status==='excluded'))return null;
 if(status==='cancelled')return {...previous,status,sourceUpdated:event.updated||previous.sourceUpdated||''};
 const startsAt=event.start.dateTime,endsAt=event.end.dateTime;
 return {
  id:clientMeetingKey(calendarId,event.id),source:clientMeetingSource,googleEventId:event.id,calendarId,
  jobId,matchedBy,status,startsAt,endsAt,date:dayAt(startsAt),start:clockAt(startsAt),end:clockAt(endsAt),
  kind:'meeting',title:event.summary||'פגישת לקוח',sourceUpdated:event.updated||'',
  url:/^https:\/\/(calendar\.google\.com|www\.google\.com)\//.test(event.htmlLink||'')?event.htmlLink:''
 };
}
const api={bounds,normalize,dayAt,clockAt,clientMeetingSource,clientMeetingKey,meetingStatus,matchClientMeeting,clientMeetingRecord};if(typeof module==='object'&&module.exports)module.exports=api;else root.NoaGoogleCalendar=api;
})(typeof globalThis!=='undefined'?globalThis:this);
